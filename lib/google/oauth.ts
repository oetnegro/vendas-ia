const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events',
]

type GoogleOAuthUrlOptions = {
  state: string
}

export function getGoogleClientId() {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
}

export function buildGoogleOAuthUrl({ state }: GoogleOAuthUrlOptions) {
  if (typeof window === 'undefined') {
    return '#'
  }

  const clientId = getGoogleClientId()

  if (!clientId) {
    return '#'
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${window.location.origin}/api/auth/google/callback`,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES.join(' '),
    include_granted_scopes: 'true',
    state,
  })

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}
