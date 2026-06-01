import { NextResponse, type NextRequest } from 'next/server'
import { refreshGoogleAccessToken, sendGmailMessage } from '@/lib/email/gmail'
import { getSupabaseAdminClient } from '@/lib/supabase-admin'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { renderRichTextHtml, renderTemplate, templateVariables } from '@/lib/template'

type SendTemplateTestBody = {
  workspaceId?: string
  campaignId?: string
  leadId?: string
  cadenceStepId?: string
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
  let body: SendTemplateTestBody

  try {
    body = (await request.json()) as SendTemplateTestBody
  } catch {
    return jsonError('Payload invalido.')
  }

  const { workspaceId, campaignId, leadId, cadenceStepId } = body

  if (!workspaceId || !campaignId || !leadId) {
    return jsonError('workspaceId, campaignId e leadId sao obrigatorios.')
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

  const [{ data: connection }, { data: campaign }, { data: lead }, { data: steps }] =
    await Promise.all([
      admin
        .from('google_connections')
        .select(
          'id, google_email, access_token_ciphertext, refresh_token_ciphertext, expires_at, status',
        )
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .eq('status', 'connected')
        .maybeSingle(),
      admin
        .from('campaigns')
        .select('id, objective')
        .eq('workspace_id', workspaceId)
        .eq('id', campaignId)
        .single(),
      admin
        .from('leads')
        .select('id, email, first_name, last_name, company, title, custom_fields')
        .eq('workspace_id', workspaceId)
        .eq('id', leadId)
        .single(),
      cadenceStepId
        ? admin
            .from('cadence_steps')
            .select('id, step_order, subject, body')
            .eq('workspace_id', workspaceId)
            .eq('campaign_id', campaignId)
            .eq('id', cadenceStepId)
            .limit(1)
        : admin
            .from('cadence_steps')
            .select('id, step_order, subject, body')
            .eq('workspace_id', workspaceId)
            .eq('campaign_id', campaignId)
            .order('step_order', { ascending: true })
            .limit(1),
    ])

  const step = steps?.[0] || null

  if (!connection?.access_token_ciphertext || !connection.google_email) {
    return jsonError('Conecte uma conta Google antes de enviar teste.', 400)
  }

  if (!campaign || !lead || !step) {
    return jsonError('Campanha, lead ou passo da cadencia nao encontrado.', 404)
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

  const variables = templateVariables(lead, campaign)
  const subject = renderTemplate(step.subject, variables)
  const renderedBody = renderTemplate(step.body, variables)
  const renderedHtmlBody = renderRichTextHtml(renderedBody)
  const gmailMessage = await sendGmailMessage({
    accessToken,
    from: connection.google_email,
    to: lead.email,
    subject,
    body: renderedBody,
    htmlBody: renderedHtmlBody,
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
    .from('leads')
    .update({
      status: 'contacted',
    })
    .eq('id', lead.id)
    .eq('workspace_id', workspaceId)

  await admin.from('activity_logs').insert({
    workspace_id: workspaceId,
    actor_user_id: userId,
    entity_type: 'email_template_test',
    entity_id: lead.id,
    action: 'sent',
    metadata: {
      campaign_id: campaignId,
      cadence_step_id: step.id,
      lead_id: lead.id,
      to: lead.email,
      subject,
      gmail_message_id: gmailMessage.id,
      gmail_thread_id: gmailMessage.threadId,
      from: connection.google_email,
      variables,
    },
  })

  return NextResponse.json({
    ok: true,
    messageId: gmailMessage.id,
    threadId: gmailMessage.threadId,
    from: connection.google_email,
    to: lead.email,
    subject,
    body: renderedBody,
  })
}
