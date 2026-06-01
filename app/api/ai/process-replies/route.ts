import { NextResponse, type NextRequest } from 'next/server'
import { processAutomaticEmailReplies } from '@/lib/ai/email-reply-engine'
import { refreshGoogleAccessToken } from '@/lib/email/gmail'
import { getSupabaseAdminClient } from '@/lib/supabase-admin'
import { getSupabaseServerClient } from '@/lib/supabase-server'

type ProcessRepliesBody = {
  workspaceId?: string
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
  let body: ProcessRepliesBody

  try {
    body = (await request.json()) as ProcessRepliesBody
  } catch {
    return jsonError('Payload invalido.')
  }

  if (!body.workspaceId) {
    return jsonError('workspaceId e obrigatorio.')
  }

  const userId = await getUserIdFromRequest(request)

  if (!userId) {
    return jsonError('Sessao invalida.', 401)
  }

  let admin = null

  try {
    admin = getSupabaseAdminClient()
  } catch {
    return jsonError('Configure SUPABASE_SERVICE_ROLE_KEY no .env.local para rodar a IA.', 500)
  }

  const { data: membership } = await admin
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', body.workspaceId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) {
    return jsonError('Usuario nao pertence a este workspace.', 403)
  }

  const { data: connection } = await admin
    .from('google_connections')
    .select('id, google_email, access_token_ciphertext, refresh_token_ciphertext, expires_at, status')
    .eq('workspace_id', body.workspaceId)
    .eq('user_id', userId)
    .eq('status', 'connected')
    .maybeSingle()

  if (!connection?.access_token_ciphertext || !connection.google_email) {
    return jsonError('Conecte uma conta Google antes de rodar a IA.', 400)
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

  const result = await processAutomaticEmailReplies({
    admin,
    workspaceId: body.workspaceId,
    actorUserId: userId,
    connection: {
      google_email: connection.google_email,
    },
    accessToken,
    limit: 20,
  })

  return NextResponse.json({
    ok: true,
    aiReplies: result,
  })
}
