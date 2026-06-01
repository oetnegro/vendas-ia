/**
 * PostHog server-side tracking.
 * Usado nas API routes para capturar eventos de backend:
 * disparo de e-mails, respostas processadas, erros de engine, etc.
 *
 * Nunca loga conteúdo de e-mail — só IDs e métricas.
 */

const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com'

type EventProperties = Record<string, string | number | boolean | null | undefined>

/**
 * Envia um evento para o PostHog a partir do servidor.
 * Fire-and-forget — não bloqueia a resposta.
 */
export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: EventProperties,
) {
  const key = process.env.POSTHOG_SERVER_KEY
  if (!key) return // silencioso se não configurado

  const payload = {
    api_key: key,
    batch: [
      {
        distinct_id: distinctId,
        event,
        properties: {
          $lib: 'posthog-node',
          ...properties,
        },
        timestamp: new Date().toISOString(),
      },
    ],
  }

  // Fire-and-forget — não await para não impactar latência
  void fetch(`${POSTHOG_HOST}/batch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // silencia erros de tracking — nunca quebrar a aplicação por isso
  })
}
