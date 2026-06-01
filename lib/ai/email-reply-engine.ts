import type { SupabaseClient } from '@supabase/supabase-js'
import { type EmailAgentMessage } from '@/lib/ai/email-agent'
import { getEmailAgentDecision } from '@/lib/ai/adk-client'
import { getGmailThread, isAutomaticEmailMessage, isBounceMessage, sendGmailMessage } from '@/lib/email/gmail'
import { createGoogleCalendarEvent } from '@/lib/google/calendar'
import type { Database, Json, LeadStatus } from '@/types/database'

type EngineThread = {
  id: string
  workspace_id: string
  lead_id: string
  gmail_thread_id: string | null
  ai_enabled: boolean
  leads: {
    id: string
    campaign_id: string | null
    email: string
    first_name: string | null
    last_name: string | null
    company: string | null
    title: string | null
    status: LeadStatus
    custom_fields: Json
  } | null
  email_messages: Array<{
    id: string
    gmail_message_id: string | null
    direction: 'inbound' | 'outbound'
    subject: string | null
    body_text: string | null
    sent_at: string | null
    created_at: string
  }>
}

type GoogleConnection = {
  google_email: string
}

export type EmailReplyEngineResult = {
  processed: number
  sent: number
  skipped: number
  rateLimited: number
  negative: number
  optedOut: number
  errors: Array<{ threadId: string; message: string }>
}

function sortMessages(messages: EngineThread['email_messages']) {
  return [...messages].sort((a, b) => {
    const aTime = new Date(a.sent_at || a.created_at).getTime()
    const bTime = new Date(b.sent_at || b.created_at).getTime()
    return aTime - bTime
  })
}

function isValidIsoDate(value: string | null | undefined) {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()))
}

async function getInboundReplyHeader({
  accessToken,
  gmailThreadId,
  gmailMessageId,
}: {
  accessToken: string
  gmailThreadId: string
  gmailMessageId: string | null
}) {
  if (!gmailMessageId) return null

  const gmailThread = await getGmailThread({
    accessToken,
    threadId: gmailThreadId,
  })
  const gmailMessage = gmailThread.messages.find((message) => message.id === gmailMessageId)

  return gmailMessage?.messageIdHeader || null
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

async function insertAiAction({
  admin,
  workspaceId,
  threadId,
  leadId,
  inboundMessageId,
  action,
  intent,
  confidence,
  summary,
  responseSubject,
  responseBody,
  sentMessageId,
  errorMessage,
  metadata,
}: {
  admin: SupabaseClient<Database>
  workspaceId: string
  threadId: string
  leadId: string
  inboundMessageId: string | null
  action: string
  intent?: string | null
  confidence?: number | null
  summary?: string | null
  responseSubject?: string | null
  responseBody?: string | null
  sentMessageId?: string | null
  errorMessage?: string | null
  metadata?: Json
}) {
  const { error } = await admin.from('email_ai_actions').upsert(
    {
      workspace_id: workspaceId,
      thread_id: threadId,
      lead_id: leadId,
      inbound_message_id: inboundMessageId,
      action,
      intent,
      confidence,
      summary,
      response_subject: responseSubject,
      response_body: responseBody,
      sent_message_id: sentMessageId,
      error_message: errorMessage,
      metadata: metadata || {},
    },
    { onConflict: 'workspace_id,inbound_message_id,action' },
  )

  if (error && !/email_ai_actions/i.test(error.message)) {
    throw error
  }
}

async function hasAiActionForInbound({
  admin,
  workspaceId,
  inboundMessageId,
}: {
  admin: SupabaseClient<Database>
  workspaceId: string
  inboundMessageId: string
}) {
  const { data, error } = await admin
    .from('email_ai_actions')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('inbound_message_id', inboundMessageId)
    .in('action', ['sent', 'skipped', 'opt_out'])
    .limit(1)

  if (error) return false

  return Boolean(data?.length)
}

async function loadAgentForLead({
  admin,
  workspaceId,
  campaignId,
}: {
  admin: SupabaseClient<Database>
  workspaceId: string
  campaignId: string | null
}) {
  let agentId: string | null = null

  if (campaignId) {
    const { data: campaign } = await admin
      .from('campaigns')
      .select('agent_id')
      .eq('workspace_id', workspaceId)
      .eq('id', campaignId)
      .maybeSingle()

    agentId = campaign?.agent_id || null
  }

  if (agentId) {
    const { data: agent } = await admin
      .from('agents')
      .select('name, business_context, common_objections, campaign_goal')
      .eq('workspace_id', workspaceId)
      .eq('id', agentId)
      .maybeSingle()

    if (agent) return agent
  }

  const { data: fallbackAgent } = await admin
    .from('agents')
    .select('name, business_context, common_objections, campaign_goal')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return fallbackAgent
}

export async function processAutomaticEmailReplies({
  admin,
  workspaceId,
  actorUserId,
  connection,
  accessToken,
  limit = 10,
  minimumInboundAgeMinutes = Number(process.env.AI_REPLY_MIN_AGE_MINUTES || 3),
  dailyWorkspaceLimit = Number(process.env.AI_DAILY_EMAIL_LIMIT_PER_WORKSPACE || 80),
}: {
  admin: SupabaseClient<Database>
  workspaceId: string
  actorUserId: string | null
  connection: GoogleConnection
  accessToken: string
  limit?: number
  minimumInboundAgeMinutes?: number
  dailyWorkspaceLimit?: number
}): Promise<EmailReplyEngineResult> {
  const result: EmailReplyEngineResult = {
    processed: 0,
    sent: 0,
    skipped: 0,
    rateLimited: 0,
    negative: 0,
    optedOut: 0,
    errors: [],
  }
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const { count: sentToday } = await admin
    .from('email_messages')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('direction', 'outbound')
    .gte('sent_at', startOfDay.toISOString())
  const remainingDailySends = Math.max(0, dailyWorkspaceLimit - (sentToday || 0))

  if (remainingDailySends <= 0) {
    result.rateLimited = 1
    return result
  }
  const sendBudget = Math.min(limit, remainingDailySends)

  const { data, error } = await admin
    .from('email_threads')
    .select(
      `
      id,
      workspace_id,
      lead_id,
      gmail_thread_id,
      ai_enabled,
      leads (
        id,
        campaign_id,
        email,
        first_name,
        last_name,
        company,
        title,
        status,
        custom_fields
      ),
      email_messages (
        id,
        gmail_message_id,
        direction,
        subject,
        body_text,
        sent_at,
        created_at
      )
    `,
    )
    .eq('workspace_id', workspaceId)
    .eq('ai_enabled', true)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    // Buscar mais candidatas que o limite de envio para ter margem após filtragem.
    .limit(Math.max(limit * 6, 30))

  if (error) throw error

  const threads = (data || []) as unknown as EngineThread[]

  for (const thread of threads) {
    try {
      if (!thread.gmail_thread_id || !thread.leads?.email) {
        result.skipped += 1
        continue
      }

      if (
        thread.leads.status === 'negative' ||
        thread.leads.status === 'opted_out' ||
        thread.leads.status === 'paused'
      ) {
        result.skipped += 1
        continue
      }

      const messages = sortMessages(thread.email_messages || [])
      const latestInbound = [...messages].reverse().find((message) => message.direction === 'inbound')

      if (!latestInbound?.id || !latestInbound.body_text?.trim()) {
        result.skipped += 1
        continue
      }

      // Bounce: e-mail inválido — bloqueia o lead para não tentar de novo
      if (
        isBounceMessage({
          from: latestInbound.subject, // bounces vêm do mailer-daemon no from
          subject: latestInbound.subject,
          bodyText: latestInbound.body_text,
        })
      ) {
        await Promise.all([
          admin.from('opt_outs').upsert(
            { workspace_id: workspaceId, email: thread.leads?.email ?? '', reason: 'bounce' },
            { onConflict: 'workspace_id,email' },
          ),
          admin
            .from('leads')
            .update({ status: 'opted_out' })
            .eq('workspace_id', workspaceId)
            .eq('id', thread.lead_id),
          insertAiAction({
            admin,
            workspaceId,
            threadId: thread.id,
            leadId: thread.lead_id,
            inboundMessageId: latestInbound.id,
            action: 'skipped',
            intent: 'neutral',
            summary: 'Bounce detectado — e-mail invalido. Lead bloqueado automaticamente.',
            responseSubject: latestInbound.subject,
            metadata: { reason: 'bounce' },
          }),
        ])
        result.skipped += 1
        continue
      }

      if (
        isAutomaticEmailMessage({
          subject: latestInbound.subject,
          bodyText: latestInbound.body_text,
        })
      ) {
        await insertAiAction({
          admin,
          workspaceId,
          threadId: thread.id,
          leadId: thread.lead_id,
          inboundMessageId: latestInbound.id,
          action: 'skipped',
          intent: 'neutral',
          summary: 'Mensagem inbound automatica detectada. IA nao respondeu.',
          responseSubject: latestInbound.subject,
          metadata: {
            reason: 'automatic_inbound_email',
          },
        })
        result.skipped += 1
        continue
      }

      const latestInboundTime = new Date(latestInbound.sent_at || latestInbound.created_at).getTime()

      if (Date.now() - latestInboundTime < minimumInboundAgeMinutes * 60_000) {
        await insertAiAction({
          admin,
          workspaceId,
          threadId: thread.id,
          leadId: thread.lead_id,
          inboundMessageId: latestInbound.id,
          action: 'deferred',
          summary: `Inbound recebido ha menos de ${minimumInboundAgeMinutes} min. Aguardando proxima execucao.`,
          metadata: { reason: 'too_fresh', min_age_minutes: minimumInboundAgeMinutes },
        }).catch(() => undefined)
        result.skipped += 1
        continue
      }
      const hasOutboundAfterInbound = messages.some((message) => {
        if (message.direction !== 'outbound') return false
        const outboundTime = new Date(message.sent_at || message.created_at).getTime()
        return outboundTime > latestInboundTime
      })

      if (hasOutboundAfterInbound) {
        result.skipped += 1
        continue
      }

      const alreadyProcessed = await hasAiActionForInbound({
        admin,
        workspaceId,
        inboundMessageId: latestInbound.id,
      })

      if (alreadyProcessed) {
        result.skipped += 1
        continue
      }

      const agent = await loadAgentForLead({
        admin,
        workspaceId,
        campaignId: thread.leads.campaign_id,
      })

      if (!agent) {
        await insertAiAction({
          admin,
          workspaceId,
          threadId: thread.id,
          leadId: thread.lead_id,
          inboundMessageId: latestInbound.id,
          action: 'skipped',
          errorMessage: 'Nenhum agente configurado para o workspace.',
        })
        result.skipped += 1
        continue
      }

      result.processed += 1
      const decision = await getEmailAgentDecision({
        agent,
        lead: thread.leads,
        messages: messages.map(
          (message): EmailAgentMessage => ({
            direction: message.direction,
            subject: message.subject,
            body_text: message.body_text,
            sent_at: message.sent_at,
          }),
        ),
      })

      if (decision.action === 'skip' || !decision.body.trim()) {
        await insertAiAction({
          admin,
          workspaceId,
          threadId: thread.id,
          leadId: thread.lead_id,
          inboundMessageId: latestInbound.id,
          action: 'skipped',
          intent: decision.intent,
          confidence: decision.confidence,
          summary: decision.summary,
          responseSubject: decision.subject,
          responseBody: decision.body,
          metadata: {
            reasoning: decision.reasoning,
            follow_up_days: decision.follow_up_days,
          },
        })
        result.skipped += 1
        continue
      }

      if (decision.action === 'opt_out' || decision.intent === 'opt_out') {
        await admin.from('opt_outs').upsert(
          {
            workspace_id: workspaceId,
            email: thread.leads.email,
            reason: decision.summary,
          },
          { onConflict: 'workspace_id,email' },
        )

        await admin
          .from('leads')
          .update({ status: 'opted_out' })
          .eq('workspace_id', workspaceId)
          .eq('id', thread.lead_id)

        await insertAiAction({
          admin,
          workspaceId,
          threadId: thread.id,
          leadId: thread.lead_id,
          inboundMessageId: latestInbound.id,
          action: 'opt_out',
          intent: decision.intent,
          confidence: decision.confidence,
          summary: decision.summary,
          responseSubject: decision.subject,
          responseBody: decision.body,
          metadata: { reasoning: decision.reasoning },
        })

        result.optedOut += 1
        continue
      }

      const isNegativeDecision =
        decision.intent === 'negative' || decision.lead_status === 'negative'

      if (result.sent >= sendBudget) {
        await insertAiAction({
          admin,
          workspaceId,
          threadId: thread.id,
          leadId: thread.lead_id,
          inboundMessageId: latestInbound.id,
          action: 'rate_limited',
          summary: 'Limite de envios por execucao atingido. Sera processado na proxima execucao.',
          metadata: { reason: 'rate_limited', send_budget: sendBudget },
        }).catch(() => undefined)
        result.rateLimited += 1
        continue
      }

      const gmailMessage = await sendGmailMessage({
        accessToken,
        from: connection.google_email,
        to: thread.leads.email,
        subject: decision.subject,
        body: decision.body,
        threadId: thread.gmail_thread_id,
        inReplyTo: await getInboundReplyHeader({
          accessToken,
          gmailThreadId: thread.gmail_thread_id,
          gmailMessageId: latestInbound.gmail_message_id,
        }),
      })
      const now = new Date().toISOString()

      await admin.from('email_messages').insert({
        workspace_id: workspaceId,
        thread_id: thread.id,
        lead_id: thread.lead_id,
        gmail_message_id: gmailMessage.id,
        direction: 'outbound',
        subject: decision.subject,
        body_text: decision.body,
        sent_at: now,
      })

      await admin
        .from('email_threads')
        .update({
          status: 'open',
          last_message_at: now,
        })
        .eq('workspace_id', workspaceId)
        .eq('id', thread.id)

      await admin
        .from('leads')
        .update({ status: decision.lead_status })
        .eq('workspace_id', workspaceId)
        .eq('id', thread.lead_id)
        .neq('status', 'meeting_booked')
        .neq('status', 'negative')
        .neq('status', 'opted_out')

      await insertAiAction({
        admin,
        workspaceId,
        threadId: thread.id,
        leadId: thread.lead_id,
        inboundMessageId: latestInbound.id,
        action: 'sent',
        intent: decision.intent,
        confidence: decision.confidence,
        summary: decision.summary,
        responseSubject: decision.subject,
        responseBody: decision.body,
        sentMessageId: gmailMessage.id,
        metadata: {
          reasoning: decision.reasoning,
          follow_up_days: decision.follow_up_days,
          gmail_thread_id: gmailMessage.threadId || thread.gmail_thread_id,
        },
      })

      if (
        decision.intent === 'meeting' &&
        decision.lead_status === 'meeting_booked' &&
        isValidIsoDate(decision.meeting_start_iso) &&
        isValidIsoDate(decision.meeting_end_iso)
      ) {
        try {
          const event = await createGoogleCalendarEvent({
            accessToken,
            summary: `Reuniao com ${thread.leads.company || thread.leads.email}`,
            description: `Criado automaticamente pelo Vendas+IA.\n\nLead: ${thread.leads.email}\nResumo IA: ${decision.summary}`,
            attendeeEmail: thread.leads.email,
            startIso: decision.meeting_start_iso as string,
            endIso: decision.meeting_end_iso as string,
          })

          await admin.from('activity_logs').insert({
            workspace_id: workspaceId,
            actor_user_id: actorUserId,
            entity_type: 'calendar_event',
            entity_id: thread.lead_id,
            action: 'created',
            metadata: {
              thread_id: thread.id,
              google_calendar_event_id: event.id,
              google_calendar_link: event.htmlLink,
              meeting_start_iso: decision.meeting_start_iso,
              meeting_end_iso: decision.meeting_end_iso,
            },
          })
        } catch (error) {
          await admin.from('activity_logs').insert({
            workspace_id: workspaceId,
            actor_user_id: actorUserId,
            entity_type: 'calendar_event',
            entity_id: thread.lead_id,
            action: 'failed',
            metadata: {
              thread_id: thread.id,
              error: error instanceof Error ? error.message : 'Erro desconhecido ao criar evento.',
              meeting_start_iso: decision.meeting_start_iso,
              meeting_end_iso: decision.meeting_end_iso,
            },
          })
        }
      }

      await admin.from('activity_logs').insert({
        workspace_id: workspaceId,
        actor_user_id: actorUserId,
        entity_type: 'email_ai_reply',
        entity_id: thread.lead_id,
        action: 'sent',
        metadata: {
          thread_id: thread.id,
          inbound_message_id: latestInbound.id,
          gmail_message_id: gmailMessage.id,
          intent: decision.intent,
          confidence: decision.confidence,
          summary: decision.summary,
        },
      })

      result.sent += 1
      if (isNegativeDecision) result.negative += 1
    } catch (error) {
      const message = getErrorMessage(error, 'Erro desconhecido na IA.')
      result.errors.push({ threadId: thread.id, message })

      await insertAiAction({
        admin,
        workspaceId,
        threadId: thread.id,
        leadId: thread.lead_id,
        inboundMessageId: null,
        action: 'error',
        errorMessage: message,
      }).catch(() => undefined)
    }
  }

  return result
}
