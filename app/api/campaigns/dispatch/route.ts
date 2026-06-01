import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-admin'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { processCampaignCadenceSends } from '@/lib/campaign-dispatch-engine'
import { refreshGoogleAccessToken } from '@/lib/email/gmail'
import { captureServerEvent } from '@/lib/posthog-server'

type DispatchBody = {
  workspaceId?: string
  campaignId?: string
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

async function getUserIdFromRequest(request: NextRequest) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await getSupabaseServerClient().auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

export async function POST(request: NextRequest) {
  let body: DispatchBody
  try {
    body = (await request.json()) as DispatchBody
  } catch {
    return jsonError('Payload invalido.')
  }

  if (!body.workspaceId) {
    return jsonError('workspaceId obrigatorio.')
  }

  const userId = await getUserIdFromRequest(request)
  if (!userId) return jsonError('Sessao invalida.', 401)

  const admin = getSupabaseAdminClient()

  // Verify workspace membership
  const { data: membership } = await admin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', body.workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) return jsonError('Usuario nao pertence a este workspace.', 403)

  // Get Google connection
  const { data: connection } = await admin
    .from('google_connections')
    .select('id, google_email, access_token_ciphertext, refresh_token_ciphertext, expires_at, user_id')
    .eq('workspace_id', body.workspaceId)
    .eq('status', 'connected')
    .not('google_email', 'is', null)
    .not('access_token_ciphertext', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!connection?.google_email || !connection.access_token_ciphertext) {
    return jsonError('Conta Google nao conectada ou sem token. Conecte o Gmail antes de disparar.')
  }

  let accessToken = connection.access_token_ciphertext
  const expiresAtMs = connection.expires_at ? new Date(connection.expires_at).getTime() : 0

  if (expiresAtMs < Date.now() + 60_000) {
    if (!connection.refresh_token_ciphertext) {
      return jsonError('Token Google expirado e sem refresh token. Reconecte o Gmail.')
    }
    try {
      const refreshed = await refreshGoogleAccessToken(connection.refresh_token_ciphertext)
      accessToken = refreshed.accessToken
      await admin
        .from('google_connections')
        .update({ access_token_ciphertext: refreshed.accessToken, expires_at: refreshed.expiresAt, status: 'connected' })
        .eq('id', connection.id)
    } catch {
      return jsonError('Falha ao renovar token Google. Reconecte o Gmail nas configuracoes.')
    }
  }

  try {
    const result = await processCampaignCadenceSends({
      admin,
      workspaceId: body.workspaceId,
      actorUserId: userId,
      connection: { google_email: connection.google_email },
      accessToken,
      campaignId: body.campaignId,
    })

    captureServerEvent(userId, 'campaign_dispatched', {
      workspace_id: body.workspaceId,
      campaign_id: body.campaignId ?? 'all',
      sent: result.sent ?? 0,
      skipped: result.skipped ?? 0,
      failed: result.failed ?? 0,
      trigger: 'manual',
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido no disparo.'
    captureServerEvent(userId, 'campaign_dispatch_error', {
      workspace_id: body.workspaceId,
      campaign_id: body.campaignId ?? 'all',
      error: message,
    })
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
