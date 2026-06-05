/**
 * Enrichment via Apify — caixa-preta para o usuário final.
 * O usuário descreve o ICP; o agente escolhe DINAMICAMENTE o actor
 * dentro da ALLOWLIST, roda com cap e devolve leads mapeados.
 *
 * Funções exportadas são estruturadas como tools independentes
 * para fácil integração futura com ADK/MCP.
 */

const APIFY_TOKEN = process.env.APIFY_TOKEN
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro'
const APIFY_BASE = 'https://api.apify.com/v2'

// ---------------------------------------------------------------------------
// Types (tool-ready signatures)
// ---------------------------------------------------------------------------

export type IcpData = {
  description: string
  role: string
  region: string
  companySize: string
  extraSignals?: string
  agentContext?: string // agents.business_context — pre-context for Gemini
}

export type ActorChoice = {
  actorId: string
  params: Record<string, unknown>
  reasoning: string
}

export type MappedLead = {
  email: string | null
  email_guessed: boolean // true = inferred from website domain
  email_valid: boolean
  first_name: string | null
  last_name: string | null
  company: string | null
  title: string | null    // job title / Cargo
  category: string | null // business sector / Setor
  website: string | null
  linkedin: string | null
  notes: string | null
}

export type ApifyRunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ABORTED' | 'TIMED-OUT'

type ActorDef = {
  id: string
  useCaseSummary: string
  exampleParams: string
  mapItem: (item: Record<string, unknown>) => MappedLead | null
}

// ---------------------------------------------------------------------------
// ALLOWLIST — only these actors can ever be called
// All actors here MUST reliably return real emails — this is an email tool.
// ---------------------------------------------------------------------------

// lukaskrivka/google-maps-with-contact-details
// 71K users, 4.6★ — finds businesses on Google Maps + enriches with leads contacts.
// Requires maximumLeadsEnrichmentRecords > 0 to actually extract emails from websites.
function mapGoogleMapsEmailItem(item: Record<string, unknown>): MappedLead | null {
  const company = (item.title as string | null) || null
  if (!company) return null

  const website = cleanUrl(item.website as string | null)
  const phone = (item.phoneUnformatted as string | null) || (item.phone as string | null) || null
  const category = (item.categoryName as string | null) || null
  const city = (item.city as string | null) || null

  // Leads enrichment (enabled when maximumLeadsEnrichmentRecords > 0) — best quality
  const enrichedLeads = (item.leads as Record<string, unknown>[] | null) || []
  const bestLead = enrichedLeads.find(
    (l) => typeof l.email === 'string' && isBusinessEmail(l.email as string),
  )

  let email: string | null = null
  let firstName: string | null = null
  let lastName: string | null = null
  let jobTitle: string | null = null

  if (bestLead) {
    email = (bestLead.email as string).toLowerCase()
    const fullName =
      (bestLead.name as string | null) || (bestLead.fullName as string | null) || null
    firstName =
      (bestLead.firstName as string | null) ||
      (fullName ? fullName.split(' ')[0] : null) ||
      null
    lastName =
      (bestLead.lastName as string | null) ||
      (fullName && fullName.includes(' ') ? fullName.split(' ').slice(1).join(' ') : null) ||
      null
    jobTitle =
      (bestLead.title as string | null) || (bestLead.jobTitle as string | null) || null
  } else {
    // Fallback: basic email fields from Google Maps listing
    const candidates: string[] = [
      item.email as string,
      ...((item.emails as string[]) || []),
      ...((item.contactEmails as string[]) || []),
    ]
      .filter(Boolean)
      .map((e) => String(e).toLowerCase().trim())

    email = candidates.find((e) => isBusinessEmail(e)) || null
  }

  const notesParts: string[] = []
  if (phone) notesParts.push(`Tel: ${phone}`)
  if (city) notesParts.push(city)

  return {
    email,
    email_guessed: false,
    email_valid: !!email,
    first_name: firstName,
    last_name: lastName,
    company,
    title: jobTitle || null,
    category: category,
    website,
    linkedin: (item.linkedin as string | null) || null,
    notes: notesParts.join(' | ') || null,
  }
}

// sovereigntaylor/b2b-leads-finder
// FREE — finds B2B contacts by job title + industry + location, verifies emails via MX.
function mapB2BLeadsItem(item: Record<string, unknown>): MappedLead | null {
  const email =
    (item.email as string | null) || (item.workEmail as string | null) || null

  const fullName = (item.name as string | null) || (item.fullName as string | null) || null
  const firstName =
    (item.firstName as string | null) ||
    (fullName ? fullName.split(' ')[0] : null) ||
    null
  const lastName =
    (item.lastName as string | null) ||
    (fullName && fullName.split(' ').length > 1
      ? fullName.split(' ').slice(1).join(' ')
      : null) ||
    null

  const company =
    (item.company as string | null) ||
    (item.companyName as string | null) ||
    (item.organization as string | null) ||
    null

  const jobTitle =
    (item.title as string | null) ||
    (item.jobTitle as string | null) ||
    (item.position as string | null) ||
    null

  const website = cleanUrl(
    (item.companyWebsite as string | null) || (item.website as string | null),
  )
  const linkedin =
    (item.linkedin as string | null) ||
    (item.linkedinUrl as string | null) ||
    (item.linkedInUrl as string | null) ||
    null

  if (!email && !firstName && !company) return null

  return {
    email: email?.toLowerCase() || null,
    email_guessed: false,
    email_valid: email ? isEmailFormat(email) : false,
    first_name: firstName,
    last_name: lastName,
    company,
    title: jobTitle,
    category: null,
    website,
    linkedin,
    notes: null,
  }
}

// khadinakbar/universal-lead-finder — DuckDuckGo + website crawl, any niche/location
function mapUniversalLeadItem(item: Record<string, unknown>): MappedLead | null {
  const company =
    (item.name as string | null) ||
    (item.companyName as string | null) ||
    (item.company as string | null) ||
    null

  const emailRaw =
    (item.email as string | null) ||
    ((item.emails as string[]) || [])[0] ||
    null
  const email = emailRaw ? String(emailRaw).toLowerCase().trim() : null

  if (!company && !email) return null

  const validEmail = email && isBusinessEmail(email) ? email : null
  const website = cleanUrl((item.website as string | null) || (item.url as string | null))
  const phone = (item.phone as string | null) || ((item.phones as string[]) || [])[0] || null

  return {
    email: validEmail,
    email_guessed: false,
    email_valid: !!validEmail,
    first_name: null,
    last_name: null,
    company,
    title: null,
    category: (item.category as string | null) || (item.type as string | null) || null,
    website,
    linkedin: (item.linkedin as string | null) || null,
    notes: phone ? `Tel: ${phone}` : null,
  }
}

// folksy_fire/google-maps-website-email-contact-extractor — Maps + website email extraction
function mapGoogleMapsContactItem(item: Record<string, unknown>): MappedLead | null {
  const company =
    (item.name as string | null) ||
    (item.businessName as string | null) ||
    (item.title as string | null) ||
    null
  if (!company) return null

  const emailRaw =
    (item.email as string | null) ||
    ((item.emails as string[]) || [])[0] ||
    null
  const email = emailRaw ? String(emailRaw).toLowerCase().trim() : null
  const validEmail = email && isBusinessEmail(email) ? email : null
  const website = cleanUrl(item.website as string | null)
  const phone = (item.phone as string | null) || ((item.phones as string[]) || [])[0] || null

  return {
    email: validEmail,
    email_guessed: false,
    email_valid: !!validEmail,
    first_name: null,
    last_name: null,
    company,
    title: null,
    category:
      (item.category as string | null) ||
      (item.categoryName as string | null) ||
      (item.type as string | null) ||
      null,
    website,
    linkedin: null,
    notes: phone ? `Tel: ${phone}` : null,
  }
}

// apify/website-content-crawler — extracts emails from pages of known domains/URLs
function mapWebsiteCrawlerItem(item: Record<string, unknown>): MappedLead | null {
  const url = (item.url as string | null) || null
  const text =
    (item.text as string | null) ||
    (item.markdown as string | null) ||
    (item.content as string | null) ||
    ''

  const emails = extractEmailsFromText(text)
  if (!emails.length) return null

  const website = url ? cleanUrl(url.split('/').slice(0, 3).join('/')) : null

  return {
    email: emails[0].toLowerCase(),
    email_guessed: false,
    email_valid: isEmailFormat(emails[0]),
    first_name: null,
    last_name: null,
    company: website
      ? (() => { try { return new URL(website).hostname.replace(/^www\./, '') } catch { return null } })()
      : null,
    title: null,
    category: null,
    website,
    linkedin: null,
    notes: emails.length > 1 ? `Emails encontrados: ${emails.join(', ')}` : null,
  }
}

export const ACTOR_ALLOWLIST: Record<string, ActorDef> = {
  // OFFICIAL Apify actor — 434K users, 4.8★, maintained by Apify
  // DEFAULT CHOICE for most ICPs — scrapeContacts:true extracts emails from business websites
  // Works for ANY business type: local, regional, B2B, regardless of job title specified
  'compass~crawler-google-places': {
    id: 'compass~crawler-google-places',
    useCaseSummary:
      'PRIMEIRA OPÇÃO para qualquer ICP. Ator OFICIAL do Apify (434K usuários, 4.8★). Busca negócios por palavra-chave + localização no Google Maps e extrai e-mails reais do site de cada empresa. Funciona para QUALQUER tipo: academias, agências de publicidade, clínicas, escritórios de advocacia, empresas de TI, restaurantes — qualquer segmento. O campo "cargo" do ICP deve virar um modificador da busca (ex: "academia dono" ou "agência publicidade CEO"). SEMPRE inclua scrapeContacts:true e website:"withWebsite" nos params.',
    exampleParams: `{"searchStringsArray":["academia fitness São Paulo"],"locationQuery":"São Paulo, Brasil","maxCrawledPlacesPerSearch":30,"scrapeContacts":true,"website":"withWebsite","language":"pt-BR","countryCode":"br"}`,
    mapItem: mapGoogleMapsEmailItem,
  },

  // Fallback: DuckDuckGo + website crawl — use when compass returns poor results
  'khadinakbar~universal-lead-finder': {
    id: 'khadinakbar~universal-lead-finder',
    useCaseSummary:
      'SEGUNDA OPÇÃO (fallback). Busca leads via DuckDuckGo + crawl de site. Use apenas quando o ICP é muito específico ou de nicho que pode não estar bem coberto no Google Maps. Funciona para qualquer nicho mas com menor cobertura geográfica que o compass. $0.003/lead, 99.4% sucesso.',
    exampleParams: `{"searchQuery":"agência publicidade São Paulo CEO email","location":"São Paulo, Brasil","maxResults":30,"crawlWebsites":true,"includeSubpages":true}`,
    mapItem: mapUniversalLeadItem,
  },

  // Best for: local businesses via Google Maps + email from website — FREE
  'folksy_fire~google-maps-website-email-contact-extractor': {
    id: 'folksy_fire~google-maps-website-email-contact-extractor',
    useCaseSummary:
      'Busca negócios no Google Maps por palavra-chave + localização e extrai e-mails e telefones visitando o site de cada empresa. Ótimo para negócios locais. GRATUITO.',
    exampleParams: `{"query":"academia fitness","location":"São Paulo, Brasil","maxResults":30,"checkSubpages":true,"hasEmailOnly":false}`,
    mapItem: mapGoogleMapsContactItem,
  },

  // Best for: extracting emails from a known list of company websites/URLs
  'apify~website-content-crawler': {
    id: 'apify~website-content-crawler',
    useCaseSummary:
      'Extrai e-mails e contatos de páginas de sites específicos. Ideal quando você já tem uma lista de domínios/URLs e quer encontrar e-mails de contato nessas páginas.',
    exampleParams: `{"startUrls":[{"url":"https://exemplo.com.br/contato"}],"maxCrawlPages":3,"crawlerType":"cheerio"}`,
    mapItem: mapWebsiteCrawlerItem,
  },
}

// ---------------------------------------------------------------------------
// capActorParams — enforce hard max per actor regardless of what Gemini generated
// ---------------------------------------------------------------------------

const MAX_RESULTS_PER_ACTOR: Record<string, string[]> = {
  'compass~crawler-google-places': ['maxCrawledPlacesPerSearch'],
  'khadinakbar~universal-lead-finder': ['maxResults'],
  'folksy_fire~google-maps-website-email-contact-extractor': ['maxResults'],
  'apify~website-content-crawler': ['maxCrawlPages'],
}

export function capActorParams(
  actorId: string,
  params: Record<string, unknown>,
  maxResults: number,
): Record<string, unknown> {
  const fields = MAX_RESULTS_PER_ACTOR[actorId] || []
  const capped = { ...params }
  for (const field of fields) {
    const current = typeof capped[field] === 'number' ? (capped[field] as number) : maxResults
    capped[field] = Math.min(current, maxResults)
  }
  // For google-maps, also cap inside startUrls arrays if needed
  return capped
}

// ---------------------------------------------------------------------------
// Tool 1: chooseActor — Gemini selects best actor + generates params
// ---------------------------------------------------------------------------

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  error?: { message?: string }
}

export async function chooseActor(icp: IcpData): Promise<ActorChoice> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada.')

  const allowlistDescription = Object.values(ACTOR_ALLOWLIST)
    .map((a) => `ID: "${a.id}" | ${a.useCaseSummary} | params exemplo: ${a.exampleParams}`)
    .join('\n')

  const prompt = `Você é um agente de enrichment B2B. Escolha o actor Apify da allowlist e gere os params para o ICP abaixo.

ICP:
- Quem: ${icp.description}
- Cargo: ${icp.role || 'qualquer'}
- Região: ${icp.region || 'Brasil'}
- Porte: ${icp.companySize || 'qualquer'}${icp.extraSignals ? `\n- Extras: ${icp.extraSignals}` : ''}

ALLOWLIST (use SOMENTE um destes IDs exatos):
${allowlistDescription}

Responda SOMENTE com JSON: {"actor_id":"<ID_EXATO_DA_ALLOWLIST>","params":{<params prontos para a API Apify, max 30 resultados>},"reasoning":"<1 frase>"}`

  const requestBody = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      // gemini-2.5 usa "thinking" por padrao, que consome o orcamento de tokens
      // e deixa o JSON vazio/truncado (erro "JSON invalido para escolha de actor").
      // Desligamos o thinking para esta tarefa estruturada e damos folga no teto.
      maxOutputTokens: 4096,
      thinkingConfig: {
        thinkingBudget: 0,
      },
    },
  })

  // Free-tier do Gemini as vezes devolve resposta vazia de forma intermitente;
  // tentamos ate 2x para a demo nao falhar num clique isolado.
  let parsed: { actor_id?: string; params?: Record<string, unknown>; reasoning?: string } | null =
    null
  let lastText = ''
  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: requestBody,
        cache: 'no-store',
      },
    )

    const json = (await res.json()) as GeminiResponse
    const text =
      json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim() || ''
    lastText = text
    if (!text) continue
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
  }

  if (!parsed) {
    throw new Error(`Gemini retornou JSON inválido para escolha de actor: ${lastText.slice(0, 200)}`)
  }

  const actorId = parsed.actor_id?.trim() || ''
  if (!ACTOR_ALLOWLIST[actorId]) {
    throw new Error(
      `Actor "${actorId}" não está na allowlist. Actors permitidos: ${Object.keys(ACTOR_ALLOWLIST).join(', ')}`,
    )
  }

  return {
    actorId,
    params: parsed.params || {},
    reasoning: parsed.reasoning || '',
  }
}

// ---------------------------------------------------------------------------
// Tool 2: startApifyRun — starts a run, returns runId
// ---------------------------------------------------------------------------

export async function startApifyRun(
  actorId: string,
  params: Record<string, unknown>,
): Promise<string> {
  if (!APIFY_TOKEN) throw new Error('APIFY_TOKEN não configurada.')
  if (!ACTOR_ALLOWLIST[actorId]) {
    throw new Error(`Actor "${actorId}" não está na allowlist.`)
  }

  const res = await fetch(
    `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    },
  )

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>
    throw new Error(
      `Apify start run falhou (${res.status}): ${(err as { error?: { message?: string } }).error?.message || res.statusText}`,
    )
  }

  const data = (await res.json()) as { data?: { id?: string } }
  const runId = data.data?.id
  if (!runId) throw new Error('Apify não retornou runId.')

  return runId
}

// ---------------------------------------------------------------------------
// Tool 3: getApifyRunStatus — polls a run
// ---------------------------------------------------------------------------

export async function getApifyRunStatus(runId: string): Promise<ApifyRunStatus> {
  if (!APIFY_TOKEN) throw new Error('APIFY_TOKEN não configurada.')

  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${APIFY_TOKEN}`, {
    cache: 'no-store',
  })

  if (!res.ok) return 'FAILED'

  const data = (await res.json()) as { data?: { status?: string } }
  const status = data.data?.status?.toUpperCase() as ApifyRunStatus | undefined

  return status || 'RUNNING'
}

// ---------------------------------------------------------------------------
// Tool 4: fetchAndMapResults — fetches dataset + maps to MappedLead[]
// ---------------------------------------------------------------------------

export async function fetchAndMapResults(
  runId: string,
  actorId: string,
): Promise<{ leads: MappedLead[]; costUsd: number; rawCount: number }> {
  if (!APIFY_TOKEN) throw new Error('APIFY_TOKEN não configurada.')

  const actor = ACTOR_ALLOWLIST[actorId]
  if (!actor) throw new Error(`Actor "${actorId}" não está na allowlist.`)

  // Fetch run metadata for cost
  const runRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${APIFY_TOKEN}`, {
    cache: 'no-store',
  })
  const runData = (await runRes.json()) as {
    data?: { usageTotalUsd?: number; defaultDatasetId?: string }
  }
  const costUsd = runData.data?.usageTotalUsd || 0

  // Fetch dataset items
  const itemsRes = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}&limit=50&clean=true`,
    { cache: 'no-store' },
  )

  if (!itemsRes.ok) throw new Error(`Falha ao buscar resultados do Apify (${itemsRes.status}).`)

  const items = (await itemsRes.json()) as Record<string, unknown>[]
  const rawCount = items.length

  const leads = items
    .map((item) => {
      try {
        return actor.mapItem(item)
      } catch {
        return null
      }
    })
    .filter((l): l is MappedLead => l !== null)

  return { leads, costUsd, rawCount }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isInAllowlist(actorId: string): boolean {
  return actorId in ACTOR_ALLOWLIST
}

// Domains that are never real business contact emails
const BLOCKED_EMAIL_DOMAINS = new Set([
  'instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'tiktok.com',
  'youtube.com', 'whatsapp.com', 'linkedin.com', 'pinterest.com',
  'wix.com', 'weebly.com', 'squarespace.com', 'shopify.com',
  'sentry.io', 'schema.org', 'example.com', 'test.com',
])

function isEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
}

function isBusinessEmail(email: string): boolean {
  if (!isEmailFormat(email)) return false
  const domain = email.split('@')[1]?.toLowerCase() || ''
  return !BLOCKED_EMAIL_DOMAINS.has(domain)
}

function cleanUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.origin
  } catch {
    return null
  }
}

function guessEmailFromWebsite(website: string): string | null {
  try {
    const domain = new URL(website).hostname.replace(/^www\./, '')
    if (!domain || BLOCKED_EMAIL_DOMAINS.has(domain)) return null
    return `contato@${domain}`
  } catch {
    return null
  }
}

function extractEmailsFromText(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  const unique = [...new Set(matches.map((e) => e.toLowerCase()))]
  // Filter out generic no-reply / placeholder emails
  return unique.filter(
    (e) =>
      !e.startsWith('noreply') &&
      !e.startsWith('no-reply') &&
      !e.startsWith('example') &&
      !e.includes('sentry') &&
      !e.includes('schema.org'),
  )
}
