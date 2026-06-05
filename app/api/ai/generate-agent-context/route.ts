import { NextResponse, type NextRequest } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import { generateGeminiContent } from '@/lib/ai/vertex'

type GenerateBody = {
  sector?: string
  language?: string
}

const SECTOR_LABELS: Record<string, string> = {
  b2b_services: 'Servicos B2B (consultoria, assessoria, terceirizacao)',
  saas: 'SaaS / Software (plataformas, ferramentas digitais)',
  agency: 'Agencia (marketing, performance, criativa)',
  intl: 'Internacional (empresas nos EUA ou Europa)',
  ecommerce: 'E-commerce / Varejo',
  health: 'Saude (clinicas, healthtech, medtech)',
  education: 'Educacao (cursos, treinamentos, edtech)',
  real_estate: 'Imobiliaria / Construcao',
  finance: 'Financas / Fintech / Contabilidade',
  hr: 'RH / Recrutamento / Beneficios',
}

function getSectorLabel(sector: string): string {
  return SECTOR_LABELS[sector] ?? sector
}

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await getSupabaseServerClient().auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) {
    return NextResponse.json({ error: 'Sessao invalida.' }, { status: 401 })
  }

  let body: GenerateBody
  try {
    body = (await req.json()) as GenerateBody
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 })
  }

  const sector = body.sector || 'b2b_services'
  const sectorLabel = getSectorLabel(sector)

  const geminiConfigured =
    process.env.GEMINI_PROVIDER === 'aistudio'
      ? !!process.env.GEMINI_API_KEY
      : !!(process.env.GCP_SA_KEY && process.env.GCP_PROJECT_ID)
  if (!geminiConfigured) {
    return NextResponse.json({ error: 'Provedor Gemini nao configurado no servidor.' }, { status: 503 })
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

  const prompt = `Voce e um especialista em vendas B2B e prospeccao outbound.
Gere um exemplo completo e realista de configuracao de agente IA de prospecao para o setor: "${sectorLabel}".

Responda SOMENTE com um JSON valido no formato abaixo, sem texto fora do JSON:

{
  "businessContext": "Descreva o negocio em 3-5 linhas: o que vende, para quem, ticket medio, diferencial e tom de voz. Escreva em portugues brasileiro de forma direta e profissional.",
  "targetAudience": "Descreva o ICP (perfil de cliente ideal): cargo, setor, tamanho de empresa, regiao. 2-3 linhas.",
  "valueProposition": "Qual o principal beneficio / resultado que o cliente obtem. 1-2 linhas objetivas.",
  "commonObjections": "Liste 3 a 5 objecoes comuns com respostas sugeridas. Formato: 'Objecao: ... | Resposta: ...' por linha.",
  "campaignGoal": "Qual o objetivo da campanha outbound. Ex: marcar reuniao de diagnostico com decisores.",
  "tone": "Descreva o tom de voz em 3-5 palavras. Ex: Direto, consultivo e humano."
}

Mantenha o texto em portugues brasileiro. Seja especifico e realista para o setor "${sectorLabel}".`

  try {
    const { json } = await generateGeminiContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    })

    if (json.error?.message) {
      return NextResponse.json({ error: `Gemini: ${json.error.message}` }, { status: 502 })
    }

    const raw = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim() ?? ''

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let parsed: Record<string, string>
    try {
      parsed = JSON.parse(cleaned) as Record<string, string>
    } catch {
      return NextResponse.json({ error: 'Resposta da IA nao era JSON valido. Tente novamente.' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, ...parsed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
