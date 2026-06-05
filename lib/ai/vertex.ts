/**
 * Camada de provider para o Gemini.
 *
 * Suporta dois back-ends, selecionados por env GEMINI_PROVIDER:
 *   - 'vertex'   -> Vertex AI (aiplatform.googleapis.com), cobra do faturamento do
 *                   Google Cloud (onde vivem os creditos). Autentica via service account.
 *   - 'aistudio' -> Google AI Studio (generativelanguage.googleapis.com), autentica
 *                   por GEMINI_API_KEY. Usa o saldo pre-pago do AI Studio.
 *
 * Os call-sites usam `generateGeminiContent(...)`: montam o mesmo body de sempre
 * (systemInstruction? + contents + generationConfig) e recebem de volta o JSON no
 * formato { candidates, error }, identico nos dois provedores — o parsing existente
 * (candidates[].content.parts[].text) continua valendo.
 */

import { GoogleAuth } from 'google-auth-library'

const VERTEX_LOCATION = process.env.GEMINI_LOCATION || 'us-central1'
const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'

export type GeminiContentPart = { text?: string }
export type GeminiContent = { role?: string; parts: GeminiContentPart[] }
export type GeminiSystemInstruction = { parts: GeminiContentPart[] }

export type GeminiResponseJson = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  error?: { message?: string }
}

export type GenerateGeminiResult = {
  ok: boolean
  status: number
  json: GeminiResponseJson
}

export type GenerateGeminiArgs = {
  model: string
  contents: GeminiContent[]
  generationConfig?: Record<string, unknown>
  systemInstruction?: GeminiSystemInstruction
}

function geminiProvider(): 'vertex' | 'aistudio' {
  return process.env.GEMINI_PROVIDER === 'aistudio' ? 'aistudio' : 'vertex'
}

// ---------------------------------------------------------------------------
// Vertex auth — service account via GoogleAuth, access token cacheado por instancia
// ---------------------------------------------------------------------------

let cachedAuth: GoogleAuth | null = null

function getGoogleAuth(): GoogleAuth {
  if (cachedAuth) return cachedAuth

  const rawKey = process.env.GCP_SA_KEY
  if (!rawKey) {
    throw new Error('GCP_SA_KEY nao configurada (JSON da service account do Vertex).')
  }

  // Aceita o JSON cru OU base64 do JSON.
  let jsonText = rawKey.trim()
  if (!jsonText.startsWith('{')) {
    try {
      jsonText = Buffer.from(jsonText, 'base64').toString('utf8')
    } catch {
      throw new Error('GCP_SA_KEY invalida: nao e JSON nem base64 de JSON.')
    }
  }

  let credentials: Record<string, unknown>
  try {
    credentials = JSON.parse(jsonText)
  } catch {
    throw new Error('GCP_SA_KEY invalida: falha ao parsear o JSON da service account.')
  }

  cachedAuth = new GoogleAuth({ credentials, scopes: [CLOUD_PLATFORM_SCOPE] })
  return cachedAuth
}

export async function getVertexAccessToken(): Promise<string> {
  const client = await getGoogleAuth().getClient()
  const token = await client.getAccessToken()
  if (!token.token) throw new Error('Vertex: nao foi possivel obter access token da service account.')
  return token.token
}

function getVertexProjectId(): string {
  const projectId = process.env.GCP_PROJECT_ID
  if (!projectId) throw new Error('GCP_PROJECT_ID nao configurada (project ID do GCP para o Vertex).')
  return projectId
}

async function vertexGenerateContent(args: GenerateGeminiArgs): Promise<GenerateGeminiResult> {
  const projectId = getVertexProjectId()
  const token = await getVertexAccessToken()

  const url =
    `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}` +
    `/locations/${VERTEX_LOCATION}/publishers/google/models/${encodeURIComponent(args.model)}:generateContent`

  const body: Record<string, unknown> = {
    contents: args.contents,
    ...(args.generationConfig ? { generationConfig: args.generationConfig } : {}),
    ...(args.systemInstruction ? { systemInstruction: args.systemInstruction } : {}),
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  const json = (await res.json()) as GeminiResponseJson
  return { ok: res.ok, status: res.status, json }
}

// ---------------------------------------------------------------------------
// AI Studio (legado) — fetch por API key
// ---------------------------------------------------------------------------

async function aiStudioGenerateContent(args: GenerateGeminiArgs): Promise<GenerateGeminiResult> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY nao configurada.')

  const body: Record<string, unknown> = {
    contents: args.contents,
    ...(args.generationConfig ? { generationConfig: args.generationConfig } : {}),
    ...(args.systemInstruction ? { systemInstruction: args.systemInstruction } : {}),
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      args.model,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    },
  )

  const json = (await res.json()) as GeminiResponseJson
  return { ok: res.ok, status: res.status, json }
}

// ---------------------------------------------------------------------------
// Wrapper unico usado pelos call-sites
// ---------------------------------------------------------------------------

export async function generateGeminiContent(args: GenerateGeminiArgs): Promise<GenerateGeminiResult> {
  return geminiProvider() === 'vertex'
    ? vertexGenerateContent(args)
    : aiStudioGenerateContent(args)
}
