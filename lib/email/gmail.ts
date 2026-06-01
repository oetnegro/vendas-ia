type GoogleTokenRefreshResponse = {
  access_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

type GmailSendResponse = {
  id?: string
  threadId?: string
  labelIds?: string[]
  error?: {
    message?: string
  }
}

type GmailHeader = {
  name?: string
  value?: string
}

type GmailMessagePart = {
  mimeType?: string
  filename?: string
  headers?: GmailHeader[]
  body?: {
    data?: string
  }
  parts?: GmailMessagePart[]
}

type GmailThreadResponse = {
  id?: string
  messages?: Array<{
    id?: string
    threadId?: string
    internalDate?: string
    snippet?: string
    payload?: GmailMessagePart
  }>
  error?: {
    message?: string
  }
}

type GmailMessageListResponse = {
  messages?: Array<{
    id?: string
    threadId?: string
  }>
  resultSizeEstimate?: number
  error?: {
    message?: string
  }
}

function base64Url(value: string) {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function encodeSubject(subject: string) {
  if (/^[\x00-\x7F]*$/.test(subject)) {
    return subject
  }

  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`
}

function createRawEmail({
  from,
  to,
  subject,
  body,
  htmlBody,
  inReplyTo,
}: {
  from: string
  to: string
  subject: string
  body: string
  htmlBody?: string | null
  inReplyTo?: string | null
}) {
  const boundary = `vendas-ia-${Date.now().toString(36)}`
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
    inReplyTo ? `References: ${inReplyTo}` : null,
    'MIME-Version: 1.0',
    htmlBody ? `Content-Type: multipart/alternative; boundary="${boundary}"` : null,
    htmlBody ? null : 'Content-Type: text/plain; charset=UTF-8',
    htmlBody ? null : 'Content-Transfer-Encoding: 8bit',
  ]
    .filter(Boolean)
    .join('\r\n')

  if (!htmlBody) {
    return base64Url(`${headers}\r\n\r\n${body}`)
  }

  const multipartBody = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    htmlBody,
    `--${boundary}--`,
  ].join('\r\n')

  return base64Url(`${headers}\r\n\r\n${multipartBody}`)
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')

  return Buffer.from(padded, 'base64').toString('utf8')
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function findHeader(headers: GmailHeader[] | undefined, name: string) {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || null
}

function extractTextFromPayload(payload?: GmailMessagePart): string | null {
  if (!payload) return null

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data).trim()
  }

  if (payload.parts?.length) {
    const plainText = payload.parts
      .map((part) => extractTextFromPayload(part))
      .find((value) => value && value.trim())

    if (plainText) return plainText
  }

  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return stripHtml(decodeBase64Url(payload.body.data))
  }

  return null
}

function parseGmailDate(internalDate?: string, dateHeader?: string | null) {
  const internalDateMs = internalDate ? Number(internalDate) : 0

  if (internalDateMs > 0) {
    return new Date(internalDateMs).toISOString()
  }

  if (dateHeader) {
    const parsed = new Date(dateHeader)

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  return new Date().toISOString()
}

export function cleanEmailReply(value: string) {
  const lines = value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')

  const stopIndex = lines.findIndex((line, index) => {
    const trimmed = line.trim()
    const nextLine = lines[index + 1]?.trim() || ''
    const followingLine = lines[index + 2]?.trim() || ''

    return (
      /^on .+ wrote:$/i.test(trimmed) ||
      /escreveu:$/i.test(trimmed) ||
      (/^em .+/i.test(trimmed) && /escreveu:$/i.test(nextLine)) ||
      (/^em .+/i.test(trimmed) && /escreveu:$/i.test(followingLine)) ||
      /^-+\s*original message\s*-+$/i.test(trimmed) ||
      /^-+\s*mensagem original\s*-+$/i.test(trimmed)
    )
  })

  const relevantLines = (stopIndex >= 0 ? lines.slice(0, stopIndex) : lines)
    .filter((line) => !line.trim().startsWith('>'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return relevantLines || value.trim()
}

export function extractEmailAddress(value: string | null | undefined) {
  if (!value) return ''

  const match = value.match(/<([^>]+)>/)
  return (match?.[1] || value).trim().toLowerCase()
}

/**
 * Detecta se um e-mail é um bounce (hard bounce / endereço inválido).
 * Diferente de auto-resposta (OOO), bounce significa que o e-mail não existe
 * e nunca deve ser tentado novamente.
 */
export function isBounceMessage({
  from,
  subject,
  bodyText,
}: {
  from?: string | null
  subject?: string | null
  bodyText?: string | null
}) {
  const fromEmail = extractEmailAddress(from)
  const normalizedSubject = (subject || '').toLowerCase()
  const normalizedBody = (bodyText || '').toLowerCase()

  return (
    /mailer-daemon|postmaster/.test(fromEmail) ||
    /delivery status notification|undeliverable|undelivered mail|failure notice|message not delivered/.test(
      normalizedSubject,
    ) ||
    /delivery to the following recipient.*failed|this is an automatically generated delivery status notification|address not found|user unknown|no such user|does not exist/.test(
      normalizedBody,
    )
  )
}

export function isAutomaticEmailMessage({
  from,
  subject,
  bodyText,
}: {
  from?: string | null
  subject?: string | null
  bodyText?: string | null
}) {
  const fromEmail = extractEmailAddress(from)
  const normalizedSubject = (subject || '').toLowerCase()
  const normalizedBody = (bodyText || '').toLowerCase()

  return (
    /mailer-daemon|postmaster|no-reply|noreply|do-not-reply|donotreply/.test(fromEmail) ||
    /delivery status notification|undeliverable|undelivered mail|mail delivery|failure notice|message not delivered/.test(
      normalizedSubject,
    ) ||
    /^automatic reply:|^auto:|out of office|fora do escritório|resposta automática/i.test(subject || '') ||
    /ticket received|support ticket|we received your request|recebemos sua solicitação/.test(
      normalizedSubject,
    ) ||
    /this is an automatically generated delivery status notification|delivery to the following recipient failed|auto-generated/.test(
      normalizedBody,
    )
  )
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth env vars are not configured.')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    cache: 'no-store',
  })

  const json = (await response.json()) as GoogleTokenRefreshResponse

  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || 'Falha ao renovar token Google.')
  }

  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString(),
  }
}

export async function sendGmailMessage({
  accessToken,
  from,
  to,
  subject,
  body,
  htmlBody,
  threadId,
  inReplyTo,
}: {
  accessToken: string
  from: string
  to: string
  subject: string
  body: string
  htmlBody?: string | null
  threadId?: string | null
  inReplyTo?: string | null
}) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      raw: createRawEmail({
        from,
        to,
        subject,
        body,
        htmlBody,
        inReplyTo,
      }),
      ...(threadId ? { threadId } : {}),
    }),
    cache: 'no-store',
  })

  const json = (await response.json()) as GmailSendResponse

  if (!response.ok || !json.id) {
    throw new Error(json.error?.message || 'Falha ao enviar pelo Gmail.')
  }

  return {
    id: json.id,
    threadId: json.threadId || null,
  }
}

export async function getGmailThread({
  accessToken,
  threadId,
}: {
  accessToken: string
  threadId: string
}) {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(
      threadId,
    )}?format=full`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    },
  )

  const json = (await response.json()) as GmailThreadResponse

  if (!response.ok || !json.id) {
    throw new Error(json.error?.message || 'Falha ao sincronizar thread Gmail.')
  }

  return {
    id: json.id,
    messages: (json.messages || [])
      .filter((message) => message.id)
      .map((message) => {
        const headers = message.payload?.headers || []

        return {
          id: message.id as string,
          threadId: message.threadId || json.id,
          from: findHeader(headers, 'from'),
          to: findHeader(headers, 'to'),
          subject: findHeader(headers, 'subject'),
          messageIdHeader: findHeader(headers, 'message-id'),
          bodyText: extractTextFromPayload(message.payload) || message.snippet || '',
          sentAt: parseGmailDate(message.internalDate, findHeader(headers, 'date')),
        }
      }),
  }
}

export async function searchGmailMessages({
  accessToken,
  query,
  maxResults = 10,
}: {
  accessToken: string
  query: string
  maxResults?: number
}) {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  })

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    },
  )

  const json = (await response.json()) as GmailMessageListResponse

  if (!response.ok) {
    throw new Error(json.error?.message || 'Falha ao buscar mensagens no Gmail.')
  }

  return (json.messages || []).filter((message) => message.id && message.threadId) as Array<{
    id: string
    threadId: string
  }>
}
