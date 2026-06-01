import { NextResponse, type NextRequest } from 'next/server'
import { getGmailThread, refreshGoogleAccessToken, sendGmailMessage } from '@/lib/email/gmail'
import { getSupabaseAdminClient } from '@/lib/supabase-admin'
import { getSupabaseServerClient } from '@/lib/supabase-server'

type ReplyBody = {
  threadId: string
  body: string
  workspaceId: string
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: NextRequest) {
  let body: ReplyBody
  try {
    body = (await request.json()) as ReplyBody
  } catch {
    return jsonError('Payload invalido.')
  }

  const { threadId, body: replyBody, workspaceId } = body

  if (!threadId || !replyBody?.trim() || !workspaceId) {
    return jsonError('threadId, body e workspaceId sao obrigatorios.')
  }

  const authorization = request.headers.get('authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return jsonError('Sessao invalida.', 401)

  const { data: userData, error: userError } = await getSupabaseServerClient().auth.getUser(token)
  if (userError || !userData.user) return jsonError('Sessao invalida.', 401)
  const userId = userData.user.id

  let admin: ReturnType<typeof getSupabaseAdminClient>
  try {
    admin = getSupabaseAdminClient()
  } catch {
    return jsonError('Configure SUPABASE_SERVICE_ROLE_KEY no .env.local.', 500)
  }

  const { data: membership } = await admin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) return jsonError('Acesso negado.', 403)

  const { data: thread } = await admin
    .from('email_threads')
    .select('id, gmail_thread_id, lead_id')
    .eq('workspace_id', workspaceId)
    .eq('id', threadId)
    .maybeSingle()

  if (!thread?.gmail_thread_id) return jsonError('Thread nao encontrada ou sem gmail_thread_id.', 404)

  const { data: leadRow } = await admin
    .from('leads')
    .select('email')
    .eq('workspace_id', workspaceId)
    .eq('id', thread.lead_id)
    .maybeSingle()

  const leadEmail = leadRow?.email
  if (!leadEmail) return jsonError('Lead sem email.', 404)

  const { data: connection } = await admin
    .from('google_connections')
    .select('id, google_email, access_token_ciphertext, refresh_token_ciphertext, expires_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status', 'connected')
    .maybeSingle()

  if (!connection?.access_token_ciphertext || !connection.google_email) {
    return jsonError('Conecte uma conta Google antes de responder.', 400)
  }

  let accessToken = connection.access_token_ciphertext
  const expiresAtMs = connection.expires_at ? new Date(connection.expires_at).getTime() : 0

  if (expiresAtMs < Date.now() + 60_000) {
    if (!connection.refresh_token_ciphertext) {
      return jsonError('Token Google expirado. Reconecte a conta Google.', 400)
    }
    try {
      const refreshed = await refreshGoogleAccessToken(connection.refresh_token_ciphertext)
      accessToken = refreshed.accessToken
      await admin
        .from('google_connections')
        .update({ access_token_ciphertext: refreshed.accessToken, expires_at: refreshed.expiresAt })
        .eq('id', connection.id)
    } catch (err) {
      await admin.from('google_connections').update({ status: 'error' }).eq('id', connection.id)
      return jsonError(`Falha ao renovar token Google: ${err instanceof Error ? err.message : 'Erro desconhecido.'}`, 400)
    }
  }

  const { data: lastMessages } = await admin
    .from('email_messages')
    .select('subject, direction, gmail_message_id')
    .eq('workspace_id', workspaceId)
    .eq('thread_id', threadId)
    .order('sent_at', { ascending: false })
    .limit(10)

  const lastSubject = lastMessages?.find((m) => m.subject)?.subject || ''
  const subject = lastSubject.trim()
    ? /^re:/i.test(lastSubject.trim())
      ? lastSubject.trim()
      : `Re: ${lastSubject.trim()}`
    : 'Re:'

  // Busca o RFC Message-ID da última mensagem para o header In-Reply-To.
  // Sem ele o Gmail pode criar uma nova thread mesmo passando threadId.
  let inReplyTo: string | null = null
  const lastGmailMessageId = lastMessages?.[0]?.gmail_message_id
  if (lastGmailMessageId) {
    try {
      const gmailThread = await getGmailThread({ accessToken, threadId: thread.gmail_thread_id })
      const match = gmailThread.messages.find((m) => m.id === lastGmailMessageId)
      inReplyTo = match?.messageIdHeader || null
    } catch { /* sem In-Reply-To — envia assim mesmo, threadId garante contexto mínimo */ }
  }

  const gmailMessage = await sendGmailMessage({
    accessToken,
    from: connection.google_email,
    to: leadEmail,
    subject,
    body: replyBody.trim(),
    threadId: thread.gmail_thread_id,
    inReplyTo,
  })

  const now = new Date().toISOString()

  await admin.from('email_messages').insert({
    workspace_id: workspaceId,
    thread_id: thread.id,
    lead_id: thread.lead_id,
    gmail_message_id: gmailMessage.id,
    direction: 'outbound',
    subject,
    body_text: replyBody.trim(),
    sent_at: now,
  })

  // Desativa IA em todas as threads do lead quando o usuário responde manualmente
  await admin
    .from('email_threads')
    .update({ ai_enabled: false, last_message_at: now })
    .eq('workspace_id', workspaceId)
    .eq('lead_id', thread.lead_id)

  await admin.from('activity_logs').insert({
    workspace_id: workspaceId,
    actor_user_id: userId,
    entity_type: 'manual_reply',
    entity_id: thread.lead_id,
    action: 'sent',
    metadata: {
      thread_id: thread.id,
      gmail_message_id: gmailMessage.id,
      gmail_thread_id: thread.gmail_thread_id,
      subject,
    },
  })

  return NextResponse.json({ ok: true, gmailMessageId: gmailMessage.id })
}
