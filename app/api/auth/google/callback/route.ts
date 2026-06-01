import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-admin'

type GoogleTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  id_token?: string
  error?: string
  error_description?: string
}

type GoogleUserInfoResponse = {
  email?: string
  verified_email?: boolean
  error?: string
}

type GoogleOAuthState = {
  id: string
  workspace_id: string
  user_id: string
  redirect_to: string | null
}

function humanizeGoogleError(error: string): string {
  switch (error) {
    case 'access_denied':
      return 'Acesso negado. Permita todos os escopos solicitados para continuar.'
    case 'invalid_grant':
      return 'Código expirado ou já utilizado. Tente conectar novamente.'
    case 'invalid_scope':
      return 'Escopo inválido na solicitação. Contate o suporte.'
    case 'redirect_uri_mismatch':
      return 'URL de redirecionamento não autorizada. Contate o suporte.'
    default:
      return error.length < 80 ? `Erro ao conectar: ${error}` : 'Falha na conexão com o Google.'
  }
}

function redirectWithStatus(
  request: NextRequest,
  redirectTo: string | null,
  status: string,
  message?: string,
) {
  const targetPath = redirectTo || '/settings/google'
  const target = new URL(targetPath, request.nextUrl.origin)
  target.searchParams.set('google', status)

  if (message) {
    target.searchParams.set('message', message)
  }

  return NextResponse.redirect(target)
}

export async function GET(request: NextRequest) {
  const admin = getSupabaseAdminClient()

  const error = request.nextUrl.searchParams.get('error')
  if (error) {
    // Best-effort: try to get redirect_to from state for better UX on errors
    const state = request.nextUrl.searchParams.get('state')
    let redirectTo: string | null = null
    if (state) {
      const { data } = await admin
        .from('google_oauth_states')
        .select('redirect_to')
        .eq('state', state)
        .maybeSingle()
      redirectTo = data?.redirect_to ?? null
    }
    return redirectWithStatus(request, redirectTo, 'error', humanizeGoogleError(error))
  }

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')

  if (!code || !state) {
    return redirectWithStatus(request, null, 'error', 'Callback do Google sem code ou state.')
  }

  const { data: stateRow, error: stateError } = await admin
    .from('google_oauth_states')
    .select('id, workspace_id, user_id, redirect_to')
    .eq('state', state)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle<GoogleOAuthState>()

  if (stateError || !stateRow) {
    console.error('[GOOGLE_OAUTH_STATE_ERROR]', stateError?.message || 'invalid_or_expired_state')
    return redirectWithStatus(
      request,
      null,
      'error',
      'Sessão de conexão expirada. Tente conectar novamente.',
    )
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return redirectWithStatus(
      request,
      stateRow.redirect_to,
      'error',
      'Configure NEXT_PUBLIC_GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no ambiente.',
    )
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/google/callback`
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
  })

  const tokenJson = (await tokenResponse.json()) as GoogleTokenResponse

  if (!tokenResponse.ok || !tokenJson.access_token) {
    console.error('[GOOGLE_TOKEN_EXCHANGE_ERROR]', {
      status: tokenResponse.status,
      error: tokenJson.error,
      description: tokenJson.error_description,
    })

    const msg = tokenJson.error
      ? humanizeGoogleError(tokenJson.error)
      : (tokenJson.error_description ?? 'Falha ao trocar code por token.')

    return redirectWithStatus(request, stateRow.redirect_to, 'error', msg)
  }

  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      authorization: `Bearer ${tokenJson.access_token}`,
    },
    cache: 'no-store',
  })

  const userInfo = (await userInfoResponse.json()) as GoogleUserInfoResponse

  if (!userInfoResponse.ok || !userInfo.email) {
    console.error('[GOOGLE_USERINFO_ERROR]', {
      status: userInfoResponse.status,
      error: userInfo.error,
    })

    return redirectWithStatus(
      request,
      stateRow.redirect_to,
      'error',
      userInfo.error || 'Não foi possível identificar o e-mail Google conectado.',
    )
  }

  const expiresAt = new Date(Date.now() + (tokenJson.expires_in || 3600) * 1000).toISOString()
  const scopes = tokenJson.scope?.split(' ').filter(Boolean) || []
  const { data: existingConnection } = await admin
    .from('google_connections')
    .select('refresh_token_ciphertext')
    .eq('workspace_id', stateRow.workspace_id)
    .eq('user_id', stateRow.user_id)
    .maybeSingle()

  const { data: connection, error: upsertError } = await admin
    .from('google_connections')
    .upsert(
      {
        workspace_id: stateRow.workspace_id,
        user_id: stateRow.user_id,
        google_email: userInfo.email,
        scopes,
        access_token_ciphertext: tokenJson.access_token,
        refresh_token_ciphertext:
          tokenJson.refresh_token || existingConnection?.refresh_token_ciphertext || null,
        expires_at: expiresAt,
        status: 'connected',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,user_id' },
    )
    .select('id')
    .single()

  if (upsertError || !connection) {
    console.error('[GOOGLE_CONNECTION_UPSERT_ERROR]', upsertError?.message || 'missing_connection')
    return redirectWithStatus(
      request,
      stateRow.redirect_to,
      'error',
      upsertError?.message || 'Não foi possível salvar a conexão Google.',
    )
  }

  const { error: stateUpdateError } = await admin
    .from('google_oauth_states')
    .update({ used_at: new Date().toISOString() })
    .eq('id', stateRow.id)

  if (stateUpdateError) {
    console.error('[GOOGLE_OAUTH_STATE_UPDATE_ERROR]', stateUpdateError.message)
  }

  await admin.from('activity_logs').insert({
    workspace_id: stateRow.workspace_id,
    actor_user_id: stateRow.user_id,
    entity_type: 'google_connection',
    entity_id: connection.id,
    action: 'connected',
    metadata: { google_email: userInfo.email },
  })

  return redirectWithStatus(request, stateRow.redirect_to, 'connected')
}
