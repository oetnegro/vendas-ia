import { NextResponse, type NextRequest } from 'next/server'
import { refreshGoogleAccessToken, sendGmailMessage } from '@/lib/email/gmail'
import { getSupabaseAdminClient } from '@/lib/supabase-admin'
import { getSupabaseServerClient } from '@/lib/supabase-server'

type SendTestBody = {
  workspaceId?: string
  to?: string
  subject?: string
  body?: string
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function getUserIdFromRequest(request: NextRequest) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '')

  if (!token) {
    return null
  }

  const { data, error } = await getSupabaseServerClient().auth.getUser(token)

  if (error || !data.user) {
    return null
  }

  return data.user.id
}

export async function POST(request: NextRequest) {
  let body: SendTestBody

  try {
    body = (await request.json()) as SendTestBody
  } catch {
    return jsonError('Payload invalido.')
  }

  const workspaceId = body.workspaceId
  const to = body.to?.trim()
  const subject = body.subject?.trim() || 'Teste Vendas+IA'
  const emailBody = body.body?.trim() || 'Este e um envio de teste do Vendas+IA.'

  if (!workspaceId) {
    return jsonError('workspaceId e obrigatorio.')
  }

  if (!to || !to.includes('@')) {
    return jsonError('Informe um destinatario valido.')
  }

  const userId = await getUserIdFromRequest(request)

  if (!userId) {
    return jsonError('Sessao invalida.', 401)
  }

  let admin = null

  try {
    admin = getSupabaseAdminClient()
  } catch {
    return jsonError('Configure SUPABASE_SERVICE_ROLE_KEY no .env.local para envio server-side.', 500)
  }

  const { data: membership } = await admin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) {
    return jsonError('Usuario nao pertence a este workspace.', 403)
  }

  const { data: connection, error: connectionError } = await admin
    .from('google_connections')
    .select(
      'id, google_email, access_token_ciphertext, refresh_token_ciphertext, expires_at, status, scopes',
    )
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status', 'connected')
    .maybeSingle()

  if (connectionError) {
    return jsonError(connectionError.message, 500)
  }

  if (!connection?.access_token_ciphertext || !connection.google_email) {
    return jsonError('Conecte uma conta Google antes de enviar teste.', 400)
  }

  let accessToken = connection.access_token_ciphertext
  const expiresAtMs = connection.expires_at ? new Date(connection.expires_at).getTime() : 0

  if (expiresAtMs < Date.now() + 60_000) {
    if (!connection.refresh_token_ciphertext) {
      return jsonError('Token Google expirado e sem refresh token. Reconecte a conta Google.', 400)
    }

    const refreshed = await refreshGoogleAccessToken(connection.refresh_token_ciphertext)
    accessToken = refreshed.accessToken

    await admin
      .from('google_connections')
      .update({
        access_token_ciphertext: refreshed.accessToken,
        expires_at: refreshed.expiresAt,
        status: 'connected',
      })
      .eq('id', connection.id)
  }

  const gmailMessage = await sendGmailMessage({
    accessToken,
    from: connection.google_email,
    to,
    subject,
    body: emailBody,
  })
  const now = new Date().toISOString()
  const { data: lead, error: leadError } = await admin
    .from('leads')
    .upsert(
      {
        workspace_id: workspaceId,
        email: to,
        source: 'dashboard_test',
        status: 'contacted',
        custom_fields: {
          test_email: true,
        },
      },
      { onConflict: 'workspace_id,email' },
    )
    .select('id')
    .single()

  if (leadError || !lead) {
    return jsonError(leadError?.message || 'Nao foi possivel registrar lead de teste.', 500)
  }

  if (gmailMessage.threadId) {
    const { data: thread, error: threadError } = await admin
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

    if (threadError || !thread) {
      return jsonError(threadError?.message || 'Nao foi possivel registrar thread de teste.', 500)
    }

    const { error: messageError } = await admin.from('email_messages').insert({
      workspace_id: workspaceId,
      thread_id: thread.id,
      lead_id: lead.id,
      gmail_message_id: gmailMessage.id,
      direction: 'outbound',
      subject,
      body_text: emailBody,
      sent_at: now,
    })

    if (messageError) {
      return jsonError(messageError.message, 500)
    }
  }

  await admin.from('activity_logs').insert({
    workspace_id: workspaceId,
    actor_user_id: userId,
    entity_type: 'email_test',
    entity_id: null,
    action: 'sent',
    metadata: {
      to,
      subject,
      gmail_message_id: gmailMessage.id,
      gmail_thread_id: gmailMessage.threadId,
      from: connection.google_email,
    },
  })

  return NextResponse.json({
    ok: true,
    messageId: gmailMessage.id,
    threadId: gmailMessage.threadId,
    from: connection.google_email,
    to,
  })
}
