import type { Json } from '@/types/database'
import type { ToolDef, ToolContext } from '@/lib/mcp/types'
import {
  chooseActor,
  startApifyRun,
  isInAllowlist,
  capActorParams,
  type IcpData,
} from '@/lib/enrichment/apify'

const MAX_RESULTS = Math.min(Number(process.env.ENRICHMENT_MAX_RESULTS_PER_RUN || 30), 100)
const LEADS_CAP = Number(process.env.ENRICHMENT_LEADS_CAP_PER_WORKSPACE || 1000)

async function getMonthlyUsed(ctx: ToolContext): Promise<number> {
  const start = new Date()
  start.setDate(1)
  start.setHours(0, 0, 0, 0)
  const { data } = await ctx.admin
    .from('enrichment_jobs')
    .select('leads_imported')
    .eq('workspace_id', ctx.auth.workspaceId)
    .eq('status', 'done')
    .gte('created_at', start.toISOString())
  return (data || []).reduce((sum, r) => sum + (r.leads_imported || 0), 0)
}

// ── create_campaign_draft ──────────────────────────────────────────────────────
const createCampaignDraft: ToolDef = {
  name: 'create_campaign_draft',
  description:
    'Cria uma campanha em RASCUNHO com os passos de cadência informados (assunto + corpo de cada e-mail). NÃO dispara envios — fica como rascunho para revisão e aprovação na plataforma.',
  scope: 'write',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nome da campanha.' },
      objective: { type: 'string', description: 'Objetivo da campanha (opcional).' },
      steps: {
        type: 'array',
        description: 'Passos da cadência, em ordem. Cada passo tem assunto, corpo e atraso em dias.',
        items: {
          type: 'object',
          properties: {
            subject: { type: 'string', description: 'Assunto do e-mail.' },
            body: { type: 'string', description: 'Corpo do e-mail.' },
            delay_days: { type: 'number', description: 'Dias de espera antes deste passo (padrão 0).' },
          },
          required: ['subject', 'body'],
        },
      },
    },
    required: ['name', 'steps'],
    additionalProperties: false,
  },
  async handler(args, ctx: ToolContext) {
    const name = String(args.name || '').trim()
    if (!name) throw new Error('Informe o nome da campanha.')

    const rawSteps = Array.isArray(args.steps) ? args.steps : []
    if (rawSteps.length === 0) throw new Error('Informe pelo menos um passo de cadência.')

    const steps = rawSteps.map((s, i) => {
      const step = s as Record<string, unknown>
      const subject = String(step.subject || '').trim()
      const body = String(step.body || '').trim()
      if (!subject || !body) throw new Error(`Passo ${i + 1}: assunto e corpo são obrigatórios.`)
      return {
        step_order: i + 1,
        delay_days: Number(step.delay_days) > 0 ? Math.floor(Number(step.delay_days)) : 0,
        subject,
        body,
      }
    })

    const { data: campaign, error } = await ctx.admin
      .from('campaigns')
      .insert({
        workspace_id: ctx.auth.workspaceId,
        name,
        objective: typeof args.objective === 'string' ? args.objective : null,
        status: 'draft',
      })
      .select('id, name, status')
      .single()

    if (error || !campaign) throw new Error(error?.message || 'Falha ao criar campanha.')

    const { error: stepsError } = await ctx.admin.from('cadence_steps').insert(
      steps.map((s) => ({
        workspace_id: ctx.auth.workspaceId,
        campaign_id: campaign.id,
        step_order: s.step_order,
        delay_days: s.delay_days,
        subject: s.subject,
        body: s.body,
        requires_approval: true,
      })),
    )

    if (stepsError) {
      // Rollback parcial: remove a campanha órfã para não deixar rascunho sem passos.
      await ctx.admin.from('campaigns').delete().eq('id', campaign.id)
      throw new Error(`Falha ao criar os passos: ${stepsError.message}`)
    }

    return {
      text: `Rascunho criado: "${campaign.name}" (id: ${campaign.id}) com ${steps.length} passo(s). Revise e aprove na plataforma antes de qualquer envio.`,
      data: { campaign_id: campaign.id, status: campaign.status, steps_created: steps.length },
      entityId: campaign.id,
      resultSummary: `rascunho ${campaign.name} (${steps.length} passos)`,
    }
  },
}

// ── enrich_leads ───────────────────────────────────────────────────────────────
const enrichLeads: ToolDef = {
  name: 'enrich_leads',
  description:
    'Inicia uma busca de novos leads a partir de uma descrição de ICP (perfil de cliente ideal). A busca roda em segundo plano e os resultados aparecem para importação na tela "Buscar Leads" da plataforma. Respeita a cota mensal do workspace.',
  scope: 'write',
  inputSchema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'Descrição do ICP (ex.: "CTOs de SaaS B2B no Brasil").' },
      role: { type: 'string', description: 'Cargo-alvo (opcional).' },
      region: { type: 'string', description: 'Região-alvo (opcional).' },
      company_size: { type: 'string', description: 'Porte da empresa (opcional).' },
      extra_signals: { type: 'string', description: 'Sinais extras de qualificação (opcional).' },
    },
    required: ['description'],
    additionalProperties: false,
  },
  async handler(args, ctx: ToolContext) {
    const description = String(args.description || '').trim()
    if (!description) throw new Error('Descreva o ICP antes de buscar.')

    const used = await getMonthlyUsed(ctx)
    if (used >= LEADS_CAP) {
      throw new Error(`Cota mensal de leads atingida (${used}/${LEADS_CAP}).`)
    }

    const icp: IcpData = {
      description,
      role: typeof args.role === 'string' ? args.role : '',
      region: typeof args.region === 'string' ? args.region : '',
      companySize: typeof args.company_size === 'string' ? args.company_size : '',
      extraSignals: typeof args.extra_signals === 'string' ? args.extra_signals : undefined,
    }

    const choice = await chooseActor(icp)
    if (!isInAllowlist(choice.actorId)) throw new Error('Estratégia de busca indisponível.')

    const cappedParams = capActorParams(choice.actorId, choice.params, MAX_RESULTS)
    const runId = await startApifyRun(choice.actorId, cappedParams)

    const promptText = [
      icp.description,
      icp.role && `cargo: ${icp.role}`,
      icp.region && `região: ${icp.region}`,
      icp.companySize && `porte: ${icp.companySize}`,
      icp.extraSignals && `extras: ${icp.extraSignals}`,
    ]
      .filter(Boolean)
      .join(', ')

    const { data: job, error } = await ctx.admin
      .from('enrichment_jobs')
      .insert({
        workspace_id: ctx.auth.workspaceId,
        user_id: ctx.auth.tokenId, // origem MCP: usamos o id do token como ator
        prompt: promptText,
        apify_actor: choice.actorId,
        apify_run_id: runId,
        params_json: { actor_params: cappedParams, reasoning: choice.reasoning, source: 'mcp' } as Json,
        status: 'running',
      })
      .select('id')
      .single()

    if (error || !job) throw new Error(error?.message || 'Falha ao registrar a busca.')

    return {
      text: `Busca de leads iniciada (job ${job.id}). Os resultados ficam prontos para revisão e importação na tela "Buscar Leads" da plataforma. Cota: ${used}/${LEADS_CAP} usados neste mês.`,
      data: { job_id: job.id, status: 'running', quota: { used, cap: LEADS_CAP } },
      entityId: job.id,
      resultSummary: `busca iniciada (job ${job.id})`,
    }
  },
}

// ── pause_campaign / resume_campaign ────────────────────────────────────────────
function transitionTool(
  name: 'pause_campaign' | 'resume_campaign',
  targetStatus: 'paused' | 'active',
  verb: string,
): ToolDef {
  return {
    name,
    description:
      name === 'pause_campaign'
        ? 'Pausa uma campanha pelo id (interrompe novos envios da cadência). Não apaga nada.'
        : 'Retoma (ativa) uma campanha pausada pelo id.',
    scope: 'write',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID da campanha.' } },
      required: ['id'],
      additionalProperties: false,
    },
    async handler(args, ctx: ToolContext) {
      const id = String(args.id || '')
      if (!id) throw new Error('Informe o id da campanha.')

      const { data: campaign, error: findErr } = await ctx.admin
        .from('campaigns')
        .select('id, name, status')
        .eq('workspace_id', ctx.auth.workspaceId)
        .eq('id', id)
        .maybeSingle()

      if (findErr) throw new Error(findErr.message)
      if (!campaign) throw new Error('Campanha não encontrada neste workspace.')

      const { error } = await ctx.admin
        .from('campaigns')
        .update({ status: targetStatus })
        .eq('workspace_id', ctx.auth.workspaceId)
        .eq('id', id)

      if (error) throw new Error(error.message)

      return {
        text: `Campanha "${campaign.name}" ${verb} (status: ${targetStatus}).`,
        data: { campaign_id: id, status: targetStatus, previous_status: campaign.status },
        entityId: id,
        resultSummary: `${campaign.name} -> ${targetStatus}`,
      }
    },
  }
}

export const writeTools: ToolDef[] = [
  createCampaignDraft,
  enrichLeads,
  transitionTool('pause_campaign', 'paused', 'pausada'),
  transitionTool('resume_campaign', 'active', 'retomada'),
]
