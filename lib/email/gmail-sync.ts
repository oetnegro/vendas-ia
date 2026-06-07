import type { SupabaseClient } from '@supabase/supabase-js'
import {
  cleanEmailReply,
  extractEmailAddress,
  getGmailThread,
  isAutomaticEmailMessage,
  searchGmailMessages,
} from '@/lib/email/gmail'
import type { Database, LeadStatus } from '@/types/database'

type EmailMessageInsert = Database['public']['Tables']['email_messages']['Insert']

type SyncThreadRow = {
  id: string
  lead_id: string
  gmail_thread_id: string | null
  leads: {
    email: string
    status: LeadStatus
  } | null
}

export type GmailSyncResult = {
  syncedThreads: number
  syncedMessages: number
  inboundMessages: number
  errors: Array<{ threadId: string; message: string }>
}

export async function syncWorkspaceGmail({
  admin,
  workspaceId,
  userId,
  connectedGoogleEmail,
  accessToken,
  maxThreads = 25,
}: {
  admin: SupabaseClient<Database>
  workspaceId: string
  userId: string | null
  connectedGoogleEmail: string
  accessToken: string
  maxThreads?: number
}): Promise<GmailSyncResult> {
  const { data: threads, error: threadsError } = await admin
    .from('email_threads')
    .select('id, lead_id, gmail_thread_id, leads(email, status)')
    .eq('workspace_id', workspaceId)
    .not('gmail_thread_id', 'is', null)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(maxThreads)

  if (threadsError) throw threadsError

  const connectedEmail = extractEmailAddress(connectedGoogleEmail)
  const errors: Array<{ threadId: string; message: string }> = []
  const processedGmailThreadIds = new Set<string>()
  let syncedThreads = 0
  let syncedMessages = 0
  let inboundMessages = 0

  async function syncGmailThread({
    appThreadId,
    leadId,
    leadStatus,
    gmailThreadId,
  }: {
    appThreadId: string
    leadId: string
    leadStatus: LeadStatus | null
    gmailThreadId: string
  }) {
    if (processedGmailThreadIds.has(gmailThreadId)) return
    processedGmailThreadIds.add(gmailThreadId)

    const gmailThread = await getGmailThread({
      accessToken,
      threadId: gmailThreadId,
    })
    let actionableInboundMessages = 0
    const messageRows: EmailMessageInsert[] = gmailThread.messages.map((message) => {
      const fromEmail = extractEmailAddress(message.from)
      const direction: 'outbound' | 'inbound' = fromEmail === connectedEmail ? 'outbound' : 'inbound'
      const bodyText = direction === 'inbound' ? cleanEmailReply(message.bodyText) : message.bodyText
      const isAutomaticInbound =
        direction === 'inbound' &&
        isAutomaticEmailMessage({
          from: message.from,
          subject: message.subject,
          bodyText,
        })

      if (direction === 'inbound') inboundMessages += 1
      if (direction === 'inbound' && !isAutomaticInbound) actionableInboundMessages += 1

      return {
        workspace_id: workspaceId,
        thread_id: appThreadId,
        lead_id: leadId,
        gmail_message_id: message.id,
        direction,
        subject: message.subject,
        body_text: bodyText,
        sent_at: message.sentAt,
      }
    })

    if (!messageRows.length) {
      syncedThreads += 1
      return
    }

    const latestMessage = messageRows.reduce((latest, current) => {
      const latestTime = new Date(latest.sent_at || 0).getTime()
      const currentTime = new Date(current.sent_at || 0).getTime()
      return currentTime > latestTime ? current : latest
    }, messageRows[0])

    const { error: upsertError } = await admin
      .from('email_messages')
      .upsert(messageRows, { onConflict: 'workspace_id,gmail_message_id' })

    if (upsertError) throw upsertError

    await admin
      .from('email_threads')
      .update({
        status: 'open',
        last_message_at: latestMessage.sent_at,
      })
      .eq('id', appThreadId)
      .eq('workspace_id', workspaceId)

    if (
      actionableInboundMessages > 0 &&
      !['meeting_booked', 'negative', 'opted_out'].includes(leadStatus || '')
    ) {
      await admin
        .from('leads')
        .update({ status: 'replied' })
        .eq('id', leadId)
        .eq('workspace_id', workspaceId)
        .neq('status', 'meeting_booked')
        .neq('status', 'negative')
        .neq('status', 'opted_out')
    }

    syncedMessages += messageRows.length
    syncedThreads += 1
  }

  for (const thread of (threads || []) as unknown as SyncThreadRow[]) {
    if (!thread.gmail_thread_id) continue

    try {
      await syncGmailThread({
        appThreadId: thread.id,
        leadId: thread.lead_id,
        leadStatus: thread.leads?.status || null,
        gmailThreadId: thread.gmail_thread_id,
      })

      const leadEmail = thread.leads?.email

      if (leadEmail) {
        const fallbackMessages = await searchGmailMessages({
          accessToken,
          query: `from:${leadEmail} newer_than:30d`,
          maxResults: 10,
        })
        const fallbackThreadIds = Array.from(
          new Set(fallbackMessages.map((message) => message.threadId)),
        )

        for (const fallbackThreadId of fallbackThreadIds) {
          if (processedGmailThreadIds.has(fallbackThreadId)) continue

          const { data: fallbackThread, error: fallbackThreadError } = await admin
            .from('email_threads')
            .upsert(
              {
                workspace_id: workspaceId,
                lead_id: thread.lead_id,
                gmail_thread_id: fallbackThreadId,
                status: 'open',
              },
              { onConflict: 'workspace_id,gmail_thread_id' },
            )
            .select('id')
            .single()

          if (fallbackThreadError || !fallbackThread) {
            throw fallbackThreadError || new Error('Nao foi possivel criar thread fallback.')
          }

          await syncGmailThread({
            appThreadId: fallbackThread.id,
            leadId: thread.lead_id,
            leadStatus: thread.leads?.status || null,
            gmailThreadId: fallbackThreadId,
          })
        }
      }
    } catch (error) {
      errors.push({
        threadId: thread.gmail_thread_id,
        message: error instanceof Error ? error.message : 'Erro desconhecido ao sincronizar.',
      })
    }
  }

  await admin.from('activity_logs').insert({
    workspace_id: workspaceId,
    actor_user_id: userId,
    entity_type: 'gmail_sync',
    entity_id: null,
    action: 'synced',
    metadata: {
      synced_threads: syncedThreads,
      synced_messages: syncedMessages,
      inbound_messages: inboundMessages,
      errors,
    },
  })

  return {
    syncedThreads,
    syncedMessages,
    inboundMessages,
    errors,
  }
}
