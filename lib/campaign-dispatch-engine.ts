import type { SupabaseClient } from '@supabase/supabase-js'
import { sendGmailMessage } from '@/lib/email/gmail'
import { renderRichTextHtml, renderTemplate, templateVariables } from '@/lib/template'
import type { Database, Json, LeadStatus } from '@/types/database'

type Campaign = {
  id: string
  workspace_id: string
  name: string
  objective: string | null
  status: 'approved' | 'active'
  daily_send_limit: number
  monthly_lead_limit: number
  sending_window: Json
  approved_at: string | null
}

type CadenceStep = {
  id: string
  step_order: number
  delay_days: number
  subject: string
  body: string
}

type Lead = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  title: string | null
  status: LeadStatus
  campaign_id: string | null
  custom_fields: Json
}

type SendJob = {
  id: string
  cadence_step_id: string | null
  lead_id: string
  status: 'queued' | 'running' | 'sent' | 'failed' | 'cancelled' | 'blocked'
  scheduled_for: string
  sent_at: string | null
  cadence_steps: { step_order: number | null } | null
}

type GoogleConnection = {
  google_email: string
}

type SendingWindow = {
  mode?: 'single' | 'blocks'
  timezone?: string
  days?: string[]
  blocks?: string[]
  time?: string
  spacing_minutes?: number
  start?: string
  end?: string
}

export type CampaignDispatchResult = {
  campaignsChecked: number
  jobsCreated: number
  sent: number
  skipped: number
  blocked: number
  failed: number
  details: Array<{
    campaignId: string
    campaignName: string
    block: string | null
    quota: number
    sent: number
    skipped: number
    failed: number
  }>
}

const DEFAULT_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri']
const DEFAULT_SEND_TIME = '09:00'
const DEFAULT_SPACING_MINUTES = 4
const SENDABLE_STATUSES: LeadStatus[] = ['new', 'queued', 'contacted']
// Jobs preso em 'running' por mais que este threshold (em minutos) são orphans de runs anteriores que crasharam.
// O cron roda a cada 5 min; 15 min é 3x o intervalo, margem suficiente para distinguir run legítima de orphan.
const STALE_RUNNING_JOB_THRESHOLD_MINUTES = 15

function parseSendingWindow(value: Json): {
  timezone: string
  days: string[]
  blocks: string[]   // sorted chronologically, always at least 1 entry
  spacing_minutes: number
} {
  const win = value && typeof value === 'object' && !Array.isArray(value) ? (value as SendingWindow) : {}
  const spacingMinutes = Number(win.spacing_minutes || DEFAULT_SPACING_MINUTES)

  // Collect all declared time blocks, fall back to legacy fields
  let rawBlocks: string[] = []
  if (Array.isArray(win.blocks) && win.blocks.length) {
    rawBlocks = win.blocks as string[]
  } else if (win.time) {
    rawBlocks = [win.time]
  } else if (win.start) {
    rawBlocks = [win.start]
  }

  const validBlocks = rawBlocks
    .filter((t) => /^\d{2}:\d{2}$/.test(t))
    .sort()

  return {
    timezone: win.timezone || 'America/Sao_Paulo',
    days: Array.isArray(win.days) && win.days.length ? win.days : DEFAULT_DAYS,
    blocks: validBlocks.length ? validBlocks : [DEFAULT_SEND_TIME],
    spacing_minutes:
      Number.isFinite(spacingMinutes) && spacingMinutes >= 1
        ? Math.min(Math.floor(spacingMinutes), 60)
        : DEFAULT_SPACING_MINUTES,
  }
}

/**
 * Returns how many emails the given block can send in the current moment,
 * given its share of the daily quota. Block quota = ceil(dailyLimit / totalBlocks).
 */
function blockQuota({
  now,
  timezone,
  days,
  blockTime,
  spacingMinutes,
  blockLimit,
}: {
  now: Date
  timezone: string
  days: string[]
  blockTime: string
  spacingMinutes: number
  blockLimit: number
}): number {
  return currentDailyQuota({
    now,
    timezone,
    days,
    time: blockTime,
    spacingMinutes,
    dailyLimit: blockLimit,
  })
}

/**
 * Returns the active block time for scheduling (the latest block whose window has opened).
 * Falls back to the first block.
 */
function activeBlockTime(now: Date, timezone: string, blocks: string[]): string {
  const parts = zonedParts(now, timezone)
  const currentMins = minutesFromMidnight(parts.time)
  let active = blocks[0]
  for (const b of blocks) {
    if (minutesFromMidnight(b) <= currentMins) active = b
    else break
  }
  return active
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date)

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const weekdayMap: Record<string, string> = {
    Sun: 'sun',
    Mon: 'mon',
    Tue: 'tue',
    Wed: 'wed',
    Thu: 'thu',
    Fri: 'fri',
    Sat: 'sat',
  }

  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
    weekday: weekdayMap[map.weekday] || '',
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  }
}

function minutesFromMidnight(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function localDateTimeToUtc(date: string, time: string, timezone: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0))

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedParts(guess, timezone)
    const desiredUtcLike = Date.UTC(year, month - 1, day, hour, minute)
    const actualUtcLike = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
    )
    guess = new Date(guess.getTime() + desiredUtcLike - actualUtcLike)
  }

  return guess
}

function currentDailyQuota({
  now,
  timezone,
  days,
  time,
  spacingMinutes,
  dailyLimit,
}: {
  now: Date
  timezone: string
  days: string[]
  time: string
  spacingMinutes: number
  dailyLimit: number
}) {
  const parts = zonedParts(now, timezone)
  if (!days.includes(parts.weekday)) return 0

  const currentMinutes = minutesFromMidnight(parts.time)
  const startMinutes = minutesFromMidnight(time)

  if (currentMinutes < startMinutes) return 0

  const sendableLimit = Math.max(0, Math.floor(dailyLimit || 0))
  const lastSendMinutes = startMinutes + Math.max(0, sendableLimit - 1) * spacingMinutes
  const cutoffMinutes = lastSendMinutes + spacingMinutes

  if (currentMinutes >= cutoffMinutes) return sendableLimit

  const elapsedMinutes = currentMinutes - startMinutes
  const available = Math.floor(elapsedMinutes / spacingMinutes) + 1

  return Math.min(sendableLimit, available)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + Math.max(0, days))
  return next
}

function startOfLocalDay(now: Date, timezone: string) {
  const parts = zonedParts(now, timezone)
  return localDateTimeToUtc(parts.date, '00:00', timezone)
}

function endOfLocalDay(now: Date, timezone: string) {
  return addDays(startOfLocalDay(now, timezone), 1)
}

async function resetStaleRunningJobs({
  admin,
  workspaceId,
  now,
}: {
  admin: SupabaseClient<Database>
  workspaceId: string
  now: Date
}) {
  const threshold = new Date(now.getTime() - STALE_RUNNING_JOB_THRESHOLD_MINUTES * 60_000).toISOString()
  await admin
    .from('send_jobs')
    .update({
      status: 'failed',
      error_message: `Job preso em 'running' por mais de ${STALE_RUNNING_JOB_THRESHOLD_MINUTES} min. Reset automatico pelo cron.`,
    })
    .eq('workspace_id', workspaceId)
    .eq('status', 'running')
    .lt('updated_at', threshold)
}

async function hasInboundAfter({
  admin,
  workspaceId,
  leadId,
  after,
}: {
  admin: SupabaseClient<Database>
  workspaceId: string
  leadId: string
  after: string
}) {
  const { count } = await admin
    .from('email_messages')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('lead_id', leadId)
    .eq('direction', 'inbound')
    .gt('sent_at', after)

  return Boolean(count)
}

async function existingJobForStep({
  admin,
  workspaceId,
  leadId,
  stepId,
}: {
  admin: SupabaseClient<Database>
  workspaceId: string
  leadId: string
  stepId: string
}) {
  const { data } = await admin
    .from('send_jobs')
    .select('id, status')
    .eq('workspace_id', workspaceId)
    .eq('lead_id', leadId)
    .eq('cadence_step_id', stepId)
    .in('status', ['queued', 'running', 'sent'])
    .limit(1)

  return Boolean(data?.length)
}

async function sendCampaignStep({
  admin,
  workspaceId,
  campaign,
  step,
  lead,
  actorUserId,
  connection,
  accessToken,
  scheduledFor,
  existingJobId,
}: {
  admin: SupabaseClient<Database>
  workspaceId: string
  campaign: Campaign
  step: CadenceStep
  lead: Lead
  actorUserId: string | null
  connection: GoogleConnection
  accessToken: string
  scheduledFor: Date
  /** Quando fornecido, usa este job existente (queued) em vez de criar um novo. */
  existingJobId?: string
}) {
  if (!existingJobId) {
    const alreadyExists = await existingJobForStep({
      admin,
      workspaceId,
      leadId: lead.id,
      stepId: step.id,
    })

    if (alreadyExists) {
      return { status: 'skipped' as const }
    }
  }

  let jobId: string

  if (existingJobId) {
    // Job já foi criado pelo disparo manual como 'queued' — só muda para 'running'
    await admin.from('send_jobs').update({ status: 'running' }).eq('id', existingJobId)
    jobId = existingJobId
  } else {
    const { data: job, error: jobError } = await admin
      .from('send_jobs')
      .insert({
        workspace_id: workspaceId,
        campaign_id: campaign.id,
        cadence_step_id: step.id,
        lead_id: lead.id,
        status: 'running',
        scheduled_for: scheduledFor.toISOString(),
      })
      .select('id')
      .single()

    if (jobError || !job) throw jobError || new Error('Nao foi possivel criar send_job.')
    jobId = job.id
  }

  try {
    const variables = templateVariables(lead, campaign)
    const subject = renderTemplate(step.subject, variables)
    const renderedBody = renderTemplate(step.body, variables)
    const htmlBody = renderRichTextHtml(renderedBody)
    const gmailMessage = await sendGmailMessage({
      accessToken,
      from: connection.google_email,
      to: lead.email,
      subject,
      body: renderedBody,
      htmlBody,
    })
    const now = new Date().toISOString()

    if (gmailMessage.threadId) {
      const { data: thread } = await admin
        .from('email_threads')
        .upsert(
          {
            workspace_id: workspaceId,
            lead_id: lead.id,
            gmail_thread_id: gmailMessage.threadId,
            status: 'open',
            last_message_at: now,
          },
          { onConflict: 'workspace_id,gmail_thread_id' },
        )
        .select('id')
        .single()

      if (thread) {
        await admin.from('email_messages').insert({
          workspace_id: workspaceId,
          thread_id: thread.id,
          lead_id: lead.id,
          gmail_message_id: gmailMessage.id,
          direction: 'outbound',
          subject,
          body_text: renderedBody,
          sent_at: now,
        })
      }
    }

    await admin
      .from('send_jobs')
      .update({ status: 'sent', sent_at: now, error_message: null })
      .eq('id', jobId)

    await admin
      .from('leads')
      .update({
        campaign_id: campaign.id,
        status: step.step_order === 1 ? 'contacted' : 'queued',
      })
      .eq('workspace_id', workspaceId)
      .eq('id', lead.id)

    await admin.from('activity_logs').insert({
      workspace_id: workspaceId,
      actor_user_id: actorUserId,
      entity_type: 'campaign_send',
      entity_id: lead.id,
      action: 'sent',
      metadata: {
        campaign_id: campaign.id,
        cadence_step_id: step.id,
        step_order: step.step_order,
        send_job_id: jobId,
        gmail_message_id: gmailMessage.id,
        gmail_thread_id: gmailMessage.threadId,
        to: lead.email,
        subject,
      },
    })

    return { status: 'sent' as const }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido no disparo.'
    await admin.from('send_jobs').update({ status: 'failed', error_message: message }).eq('id', jobId)
    return { status: 'failed' as const, message }
  }
}

/**
 * Executa os send_jobs com status 'queued' cujo scheduled_for já passou.
 * Usado pelo cron para processar jobs agendados pelo disparo manual.
 */
async function executeQueuedJobs({
  admin,
  workspaceId,
  connection,
  accessToken,
  actorUserId,
  now,
  result,
}: {
  admin: SupabaseClient<Database>
  workspaceId: string
  connection: GoogleConnection
  accessToken: string
  actorUserId: string | null
  now: Date
  result: CampaignDispatchResult
}) {
  const { data: dueJobs } = await admin
    .from('send_jobs')
    .select('id, campaign_id, cadence_step_id, lead_id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'queued')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(50)

  if (!dueJobs?.length) return

  for (const job of dueJobs) {
    try {
      const [campaignRes, stepRes, leadRes] = await Promise.all([
        admin
          .from('campaigns')
          .select('id, workspace_id, name, objective, status, daily_send_limit, monthly_lead_limit, sending_window, approved_at')
          .eq('id', job.campaign_id)
          .in('status', ['approved', 'active'])
          .single(),
        admin
          .from('cadence_steps')
          .select('id, step_order, delay_days, subject, body')
          .eq('id', job.cadence_step_id ?? '')
          .single(),
        admin
          .from('leads')
          .select('id, email, first_name, last_name, company, title, status, campaign_id, custom_fields')
          .eq('workspace_id', workspaceId)
          .eq('id', job.lead_id)
          .single(),
      ])

      const campaign = campaignRes.data as Campaign | null
      const step = stepRes.data as CadenceStep | null
      const lead = leadRes.data as Lead | null

      if (!campaign || !step || !lead) {
        await admin.from('send_jobs').update({ status: 'cancelled' }).eq('id', job.id)
        continue
      }

      // Verifica opt-out
      const { data: optOut } = await admin
        .from('opt_outs')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('email', lead.email)
        .maybeSingle()

      if (optOut) {
        await admin.from('send_jobs').update({ status: 'blocked' }).eq('id', job.id)
        result.blocked += 1
        continue
      }

      const sent = await sendCampaignStep({
        admin,
        workspaceId,
        campaign,
        step,
        lead,
        actorUserId,
        connection,
        accessToken,
        scheduledFor: now,
        existingJobId: job.id,
      })

      if (sent.status === 'sent') {
        result.sent += 1
      } else if (sent.status === 'failed') {
        result.failed += 1
      } else {
        result.skipped += 1
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao executar job agendado.'
      await admin.from('send_jobs').update({ status: 'failed', error_message: message }).eq('id', job.id)
      result.failed += 1
    }
  }
}

export async function processCampaignCadenceSends({
  admin,
  workspaceId,
  actorUserId,
  connection,
  accessToken,
  campaignId,
  now = new Date(),
}: {
  admin: SupabaseClient<Database>
  workspaceId: string
  actorUserId: string | null
  connection: GoogleConnection
  accessToken: string
  /** When set, only this campaign is processed (manual per-campaign dispatch). */
  campaignId?: string
  now?: Date
}): Promise<CampaignDispatchResult> {
  const result: CampaignDispatchResult = {
    campaignsChecked: 0,
    jobsCreated: 0,
    sent: 0,
    skipped: 0,
    blocked: 0,
    failed: 0,
    details: [],
  }

  await resetStaleRunningJobs({ admin, workspaceId, now })

  // Executa jobs pré-agendados (ex: agendados pelo disparo manual) que já estão vencidos
  await executeQueuedJobs({ admin, workspaceId, connection, accessToken, actorUserId, now, result })

  let campaignQuery = admin
    .from('campaigns')
    .select('id, workspace_id, name, objective, status, daily_send_limit, monthly_lead_limit, sending_window, approved_at')
    .eq('workspace_id', workspaceId)
    .in('status', ['approved', 'active'])
    .gt('daily_send_limit', 0)
    .order('approved_at', { ascending: true })

  if (campaignId) {
    campaignQuery = campaignQuery.eq('id', campaignId)
  }

  const { data: campaigns, error: campaignError } = await campaignQuery

  if (campaignError) throw campaignError

  // Contador global de jobs agendados no disparo manual (para espaçar scheduled_for entre campanhas)
  let manualQueueIndex = 0

  for (const campaign of (campaigns || []) as Campaign[]) {
    const window = parseSendingWindow(campaign.sending_window)
    const perBlockLimit = Math.ceil(campaign.daily_send_limit / window.blocks.length)

    // Sum quota across all blocks
    const cumulativeQuota = window.blocks.reduce((sum, blockTime) => {
      return sum + blockQuota({
        now,
        timezone: window.timezone,
        days: window.days,
        blockTime,
        spacingMinutes: window.spacing_minutes,
        blockLimit: perBlockLimit,
      })
    }, 0)

    // Disparo manual (campaignId definido) ignora janela de horário — usa daily_send_limit direto
    const isManualDispatch = Boolean(campaignId)
    const effectiveQuota = isManualDispatch
      ? campaign.daily_send_limit
      : cumulativeQuota

    const currentBlock = effectiveQuota > 0
      ? activeBlockTime(now, window.timezone, window.blocks)
      : null

    const detail = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      block: currentBlock,
      quota: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    }

    result.campaignsChecked += 1

    if (effectiveQuota <= 0) {
      result.details.push(detail)
      continue
    }

    const dayStart = startOfLocalDay(now, window.timezone)
    const dayEnd = endOfLocalDay(now, window.timezone)
    detail.quota = effectiveQuota

    const { count: sentToday } = await admin
      .from('send_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('campaign_id', campaign.id)
      .eq('status', 'sent')
      .gte('sent_at', dayStart.toISOString())
      .lt('sent_at', dayEnd.toISOString())

    let remaining = Math.max(0, effectiveQuota - (sentToday || 0))

    if (remaining <= 0) {
      result.details.push(detail)
      continue
    }

    const { data: steps } = await admin
      .from('cadence_steps')
      .select('id, step_order, delay_days, subject, body')
      .eq('workspace_id', workspaceId)
      .eq('campaign_id', campaign.id)
      .order('step_order', { ascending: true })

    if (!steps?.length) {
      result.details.push(detail)
      continue
    }

    const { data: leads } = await admin
      .from('leads')
      .select('id, email, first_name, last_name, company, title, status, campaign_id, custom_fields')
      .eq('workspace_id', workspaceId)
      .in('status', SENDABLE_STATUSES)
      .or(`campaign_id.is.null,campaign_id.eq.${campaign.id}`)
      .order('created_at', { ascending: true })
      .limit(500)

    // Prioriza leads nunca contatados (status='new') para receberem o step 1 antes de follow-ups
    const prioritizedLeads = ((leads || []) as Lead[]).sort((a, b) => {
      const priority: Record<string, number> = { new: 0, queued: 1, contacted: 2 }
      const pa = priority[a.status] ?? 3
      const pb = priority[b.status] ?? 3
      return pa - pb
    })

    for (const lead of prioritizedLeads) {
      if (remaining <= 0) break

      const { data: optOut } = await admin
        .from('opt_outs')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('email', lead.email)
        .maybeSingle()

      if (optOut) {
        result.blocked += 1
        detail.skipped += 1
        continue
      }

      const { data: jobs } = await admin
        .from('send_jobs')
        .select('id, cadence_step_id, lead_id, status, scheduled_for, sent_at, cadence_steps(step_order)')
        .eq('workspace_id', workspaceId)
        .eq('campaign_id', campaign.id)
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: true })

      const sentJobs = ((jobs || []) as unknown as SendJob[]).filter((job) => job.status === 'sent')
      const lastSentJob = sentJobs
        .filter((job) => job.cadence_steps?.step_order)
        .sort((a, b) => (a.cadence_steps?.step_order || 0) - (b.cadence_steps?.step_order || 0))
        .at(-1)
      const nextStep =
        lastSentJob?.cadence_steps?.step_order
          ? (steps as CadenceStep[]).find((step) => step.step_order === (lastSentJob.cadence_steps?.step_order || 0) + 1)
          : (steps as CadenceStep[])[0]

      if (!nextStep) {
        result.skipped += 1
        detail.skipped += 1
        continue
      }

      const existing = (jobs || []).some(
        (job) =>
          job.cadence_step_id === nextStep.id &&
          ['queued', 'running', 'sent'].includes(job.status),
      )

      if (existing) {
        result.skipped += 1
        detail.skipped += 1
        continue
      }

      const baseDate = lastSentJob?.sent_at
        ? new Date(lastSentJob.sent_at)
        : new Date(campaign.approved_at || campaign.workspace_id)
      const dueAt = addDays(
        Number.isNaN(baseDate.getTime()) ? new Date(campaign.approved_at || now) : baseDate,
        nextStep.delay_days,
      )

      if (dueAt.getTime() > now.getTime()) {
        result.skipped += 1
        detail.skipped += 1
        continue
      }

      if (lastSentJob?.sent_at) {
        const replied = await hasInboundAfter({
          admin,
          workspaceId,
          leadId: lead.id,
          after: lastSentJob.sent_at,
        })

        if (replied) {
          result.skipped += 1
          detail.skipped += 1
          continue
        }
      }

      if (isManualDispatch) {
        // Disparo manual: cria job 'queued' com scheduled_for espaçado (anti-spam)
        // O cron executará cada job no momento correto
        const alreadyExists = await existingJobForStep({
          admin,
          workspaceId,
          leadId: lead.id,
          stepId: nextStep.id,
        })

        if (alreadyExists) {
          result.skipped += 1
          detail.skipped += 1
          continue
        }

        const scheduledFor = new Date(now.getTime() + manualQueueIndex * window.spacing_minutes * 60_000)
        const { error: insertError } = await admin.from('send_jobs').insert({
          workspace_id: workspaceId,
          campaign_id: campaign.id,
          cadence_step_id: nextStep.id,
          lead_id: lead.id,
          status: 'queued',
          scheduled_for: scheduledFor.toISOString(),
        })

        if (insertError) {
          result.failed += 1
          detail.failed += 1
        } else {
          manualQueueIndex += 1
          remaining -= 1
          result.jobsCreated += 1
          detail.sent += 1 // contado como "agendado" no retorno
        }
        continue
      }

      const parts = zonedParts(now, window.timezone)
      const scheduleTime = currentBlock ?? window.blocks[0]
      const scheduledFor = localDateTimeToUtc(parts.date, scheduleTime, window.timezone)
      let sent: { status: 'sent' | 'skipped' | 'failed'; message?: string }

      try {
        sent = await sendCampaignStep({
          admin,
          workspaceId,
          campaign,
          step: nextStep,
          lead,
          actorUserId,
          connection,
          accessToken,
          scheduledFor,
        })
      } catch (dispatchError) {
        const message = dispatchError instanceof Error ? dispatchError.message : 'Erro inesperado no disparo.'
        sent = { status: 'failed', message }
      }

      if (sent.status === 'sent') {
        remaining -= 1
        result.jobsCreated += 1
        result.sent += 1
        detail.sent += 1
      } else if (sent.status === 'failed') {
        result.failed += 1
        detail.failed += 1
      } else {
        result.skipped += 1
        detail.skipped += 1
      }
    }

    if (campaign.status === 'approved' && detail.sent > 0) {
      await admin
        .from('campaigns')
        .update({ status: 'active' })
        .eq('workspace_id', workspaceId)
        .eq('id', campaign.id)
    }

    result.details.push(detail)
  }

  return result
}
