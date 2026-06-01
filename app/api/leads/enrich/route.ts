import { NextResponse, type NextRequest } from 'next/server'
import type { Json } from '@/types/database'
import { getSupabaseAdminClient } from '@/lib/supabase-admin'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import {
  chooseActor,
  startApifyRun,
  getApifyRunStatus,
  fetchAndMapResults,
  isInAllowlist,
  capActorParams,
  type IcpData,
  type MappedLead,
} from '@/lib/enrichment/apify'

const MAX_RESULTS = Math.min(
  Number(process.env.ENRICHMENT_MAX_RESULTS_PER_RUN || 30),
  100, // hard ceiling — never exceed 100 regardless of env
)

export const maxDuration = 30 // seconds — each handler is short; UI polls

const LEADS_CAP = Number(process.env.ENRICHMENT_LEADS_CAP_PER_WORKSPACE || 1000)

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function getUserId(request: NextRequest): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await getSupabaseServerClient().auth.getUser(token)
  return data.user?.id || null
}

async function assertMembership(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  workspaceId: string,
  userId: string,
) {
  const { data } = await admin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

async function getMonthlyUsed(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  workspaceId: string,
): Promise<number> {
  const start = new Date()
  start.setDate(1)
  start.setHours(0, 0, 0, 0)

  const { data } = await admin
    .from('enrichment_jobs')
    .select('leads_imported')
    .eq('workspace_id', workspaceId)
    .eq('status', 'done')
    .gte('created_at', start.toISOString())

  return (data || []).reduce((sum, r) => sum + (r.leads_imported || 0), 0)
}

// ---------------------------------------------------------------------------
// POST — action: 'start' | 'import'
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const userId = await getUserId(request)
  if (!userId) return jsonError('Sessão inválida.', 401)

  let admin: ReturnType<typeof getSupabaseAdminClient>
  try {
    admin = getSupabaseAdminClient()
  } catch {
    return jsonError('Configure SUPABASE_SERVICE_ROLE_KEY no servidor.', 500)
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return jsonError('Payload inválido.')
  }

  const action = body.action as string
  const workspaceId = body.workspaceId as string

  if (!workspaceId) return jsonError('workspaceId obrigatório.')
  if (!(await assertMembership(admin, workspaceId, userId))) {
    return jsonError('Usuário não pertence a este workspace.', 403)
  }

  // ── START ──────────────────────────────────────────────────────────────────
  if (action === 'start') {
    const icp = body.icp as IcpData | null
    if (!icp?.description?.trim()) return jsonError('Descreva o ICP antes de buscar.')

    // Quota check
    const used = await getMonthlyUsed(admin, workspaceId)
    if (used >= LEADS_CAP) {
      return NextResponse.json(
        { error: 'quota_exceeded', used, cap: LEADS_CAP },
        { status: 429 },
      )
    }

    // Choose actor (Gemini)
    let choice
    try {
      choice = await chooseActor(icp)
    } catch (err) {
      return jsonError(`Falha ao escolher estratégia de busca: ${(err as Error).message}`, 500)
    }

    // Safety: double-check allowlist
    if (!isInAllowlist(choice.actorId)) {
      return jsonError('Actor selecionado fora da allowlist.', 500)
    }

    // Enforce hard cap before calling Apify
    const cappedParams = capActorParams(choice.actorId, choice.params, MAX_RESULTS)

    // Start Apify run
    let runId: string
    try {
      runId = await startApifyRun(choice.actorId, cappedParams)
    } catch (err) {
      return jsonError(`Falha ao iniciar busca: ${(err as Error).message}`, 500)
    }

    // Persist job
    const promptText = [
      icp.description,
      icp.role && `cargo: ${icp.role}`,
      icp.region && `região: ${icp.region}`,
      icp.companySize && `porte: ${icp.companySize}`,
      icp.extraSignals && `extras: ${icp.extraSignals}`,
    ]
      .filter(Boolean)
      .join(', ')

    const { data: job, error: jobErr } = await admin
      .from('enrichment_jobs')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        prompt: promptText,
        apify_actor: choice.actorId,
        apify_run_id: runId,
        params_json: { actor_params: cappedParams, reasoning: choice.reasoning } as Json,
        status: 'running',
      })
      .select('id')
      .single()

    if (jobErr || !job) return jsonError(jobErr?.message || 'Erro ao registrar job.', 500)

    await admin.from('activity_logs').insert({
      workspace_id: workspaceId,
      actor_user_id: userId,
      entity_type: 'enrichment_job',
      entity_id: job.id,
      action: 'started',
      metadata: {
        prompt: promptText,
        actor_chosen: choice.actorId,
        reasoning: choice.reasoning,
        quota_used: used,
        quota_cap: LEADS_CAP,
      },
    })

    return NextResponse.json({
      jobId: job.id,
      status: 'running',
      actorChosen: true,
      reasoning: choice.reasoning,
    })
  }

  // ── IMPORT ────────────────────────────────────────────────────────────────
  if (action === 'import') {
    const jobId = body.jobId as string
    if (!jobId) return jsonError('jobId obrigatório.')

    const { data: job, error: jobErr } = await admin
      .from('enrichment_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('workspace_id', workspaceId)
      .single()

    if (jobErr || !job) return jsonError('Job não encontrado.', 404)
    if (job.status !== 'preview_ready') {
      return jsonError(`Job não está pronto para importação (status: ${job.status}).`)
    }

    const previewLeads = (
      (job.params_json as Record<string, unknown>)?.preview_leads as MappedLead[]
    ) || []

    // Only import leads with valid emails
    const importable = previewLeads.filter((l) => l.email_valid && l.email)

    // Quota check
    const used = await getMonthlyUsed(admin, workspaceId)
    const remaining = LEADS_CAP - used
    const toImport = importable.slice(0, Math.max(0, remaining))

    if (toImport.length === 0) {
      return jsonError(
        remaining <= 0
          ? `Quota mensal atingida (${used}/${LEADS_CAP} leads).`
          : 'Nenhum lead com e-mail válido para importar.',
        429,
      )
    }

    // Dedupe against existing leads
    const emails = toImport.map((l) => l.email!.toLowerCase())
    const { data: existing } = await admin
      .from('leads')
      .select('email')
      .eq('workspace_id', workspaceId)
      .in('email', emails)

    const existingEmails = new Set((existing || []).map((r) => r.email.toLowerCase()))
    const newLeads = toImport.filter((l) => !existingEmails.has(l.email!.toLowerCase()))
    const dupeCount = toImport.length - newLeads.length

    const rows = newLeads.map((l) => ({
      workspace_id: workspaceId,
      email: l.email!.toLowerCase(),
      first_name: l.first_name,
      last_name: l.last_name,
      company: l.company,
      title: l.title,
      source: 'enrichment_ai',
      custom_fields: {
        email_guessed: l.email_guessed,
        enrichment_job_id: jobId,
        ...(l.website ? { website: l.website } : {}),
        ...(l.linkedin ? { linkedin: l.linkedin } : {}),
        ...(l.category ? { sector: l.category } : {}),
        ...(l.notes ? { enrichment_notes: l.notes } : {}),
      },
    }))

    if (rows.length > 0) {
      const { error: insertErr } = await admin
        .from('leads')
        .upsert(rows, { onConflict: 'workspace_id,email' })
      if (insertErr) return jsonError(insertErr.message, 500)
    }

    // Update job
    await admin
      .from('enrichment_jobs')
      .update({ status: 'done', leads_imported: rows.length })
      .eq('id', jobId)

    const newUsed = used + rows.length
    await admin.from('activity_logs').insert({
      workspace_id: workspaceId,
      actor_user_id: userId,
      entity_type: 'enrichment_job',
      entity_id: jobId,
      action: 'imported',
      metadata: {
        leads_imported: rows.length,
        dupes_skipped: dupeCount,
        quota_used: newUsed,
        quota_cap: LEADS_CAP,
      },
    })

    return NextResponse.json({
      imported: rows.length,
      dupes_skipped: dupeCount,
      quota: { used: newUsed, cap: LEADS_CAP },
    })
  }

  return jsonError('action deve ser "start" ou "import".')
}

// ---------------------------------------------------------------------------
// GET — poll job status + return preview when ready
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')
  const workspaceId = searchParams.get('workspaceId')

  if (!jobId || !workspaceId) return jsonError('jobId e workspaceId obrigatórios.')

  const userId = await getUserId(request)
  if (!userId) return jsonError('Sessão inválida.', 401)

  let admin: ReturnType<typeof getSupabaseAdminClient>
  try {
    admin = getSupabaseAdminClient()
  } catch {
    return jsonError('Configure SUPABASE_SERVICE_ROLE_KEY no servidor.', 500)
  }

  if (!(await assertMembership(admin, workspaceId, userId))) {
    return jsonError('Usuário não pertence a este workspace.', 403)
  }

  const { data: job, error: jobErr } = await admin
    .from('enrichment_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('workspace_id', workspaceId)
    .single()

  if (jobErr || !job) return jsonError('Job não encontrado.', 404)

  // If already processed, return cached preview
  if (job.status === 'preview_ready' || job.status === 'done') {
    const previewLeads = (
      (job.params_json as Record<string, unknown>)?.preview_leads as MappedLead[]
    ) || []
    const used = await getMonthlyUsed(admin, workspaceId)
    return NextResponse.json({
      status: job.status,
      leads: previewLeads,
      result_count: job.result_count,
      valid_count: previewLeads.filter((l) => l.email_valid).length,
      leads_imported: job.leads_imported,
      quota: { used, cap: LEADS_CAP },
    })
  }

  if (job.status === 'failed') {
    return NextResponse.json({ status: 'failed', error: 'Busca falhou. Tente novamente.' })
  }

  if (job.status !== 'running' || !job.apify_run_id) {
    return NextResponse.json({ status: job.status })
  }

  // Check Apify run status
  let apifyStatus
  try {
    apifyStatus = await getApifyRunStatus(job.apify_run_id)
  } catch {
    return NextResponse.json({ status: 'running' })
  }

  if (apifyStatus === 'RUNNING') {
    return NextResponse.json({ status: 'running' })
  }

  if (apifyStatus !== 'SUCCEEDED') {
    await admin.from('enrichment_jobs').update({ status: 'failed' }).eq('id', jobId)
    return NextResponse.json({
      status: 'failed',
      error: `Busca encerrada com status ${apifyStatus}.`,
    })
  }

  // Fetch + map results
  let results
  try {
    results = await fetchAndMapResults(job.apify_run_id, job.apify_actor)
  } catch (err) {
    await admin.from('enrichment_jobs').update({ status: 'failed' }).eq('id', jobId)
    return NextResponse.json({ status: 'failed', error: (err as Error).message })
  }

  const validCount = results.leads.filter((l) => l.email_valid).length

  // Persist preview into job record
  await admin
    .from('enrichment_jobs')
    .update({
      status: 'preview_ready',
      result_count: results.rawCount,
      cost_usd: results.costUsd,
      params_json: {
        ...((job.params_json as Record<string, unknown>) || {}),
        preview_leads: results.leads,
      } as Json,
    })
    .eq('id', jobId)

  const used = await getMonthlyUsed(admin, workspaceId)

  return NextResponse.json({
    status: 'preview_ready',
    leads: results.leads,
    result_count: results.rawCount,
    valid_count: validCount,
    leads_imported: 0,
    quota: { used, cap: LEADS_CAP },
  })
}
