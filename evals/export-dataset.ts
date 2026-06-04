// Export do dataset de evals a partir das conversas REAIS do Vendas+IA (WhatsApp).
// SOMENTE LEITURA das tabelas legadas vendas_* (produção). Nunca escreve.
//
// Saída: evals/datasets/whatsapp_labeled.jsonl (1 conversa por linha).
// Esse arquivo contém PII e está no .gitignore — NUNCA commitar.
//
// Rodar: npm run eval:export
//   (usa node --env-file=.env.local para carregar SUPABASE_SERVICE_ROLE_KEY etc.)

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getSupabaseAdminClient } from '../lib/supabase-admin.ts'
import { LABEL_MAP, isLabeledOutcome, type ExpectedIntent } from './label-map.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(__dirname, 'datasets/whatsapp_labeled.jsonl')

type ChatMessage = { direction: 'inbound' | 'outbound'; body_text: string | null; sent_at: string | null }

export type DatasetRow = {
  id_conversa: string
  status_funil: string
  messages: ChatMessage[]
  expected_intent: ExpectedIntent
  expected_meeting: { has: boolean; date?: string | null }
}

// content de mensagens "ai" costuma vir como ```json { "resposta_para_lead": "..." } ```.
// Extrai só o texto enviado ao lead; se não for JSON, usa o content cru.
function extractAiText(raw: string | null): string | null {
  if (!raw) return null
  const stripped = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  try {
    const parsed = JSON.parse(stripped)
    if (parsed && typeof parsed === 'object' && typeof parsed.resposta_para_lead === 'string') {
      return parsed.resposta_para_lead.trim()
    }
  } catch {
    // não é JSON: cai no content cru
  }
  return raw.trim()
}

async function main() {
  const db = getSupabaseAdminClient() as unknown as {
    from: (t: string) => any
  }

  // 1) Leads rotulados (apenas desfechos que estão no gabarito).
  const { data: leads, error: leadsErr } = await db
    .from('vendas_leads_consolidados')
    .select('id_conversa, status_funil, data_reuniao')
    .in('status_funil', Object.keys(LABEL_MAP))
  if (leadsErr) throw leadsErr

  const labeled = (leads as Array<{ id_conversa: string; status_funil: string | null; data_reuniao: string | null }>)
    .filter((l) => l.id_conversa && isLabeledOutcome(l.status_funil))

  const rows: DatasetRow[] = []
  let semHuman = 0

  for (const lead of labeled) {
    // 2) Conversa ordenada por id (sem timestamp confiável na origem).
    const { data: chat, error: chatErr } = await db
      .from('vendascopy_chat_histories_duplicate')
      .select('id, message')
      .eq('session_id', lead.id_conversa)
      .order('id', { ascending: true })
    if (chatErr) throw chatErr

    const messages: ChatMessage[] = []
    let hasHuman = false
    for (const r of chat as Array<{ id: number; message: any }>) {
      const m = r.message || {}
      const type = m.type
      if (type === 'human') {
        const body = typeof m.content === 'string' ? m.content.trim() : null
        if (!body) continue
        hasHuman = true
        messages.push({ direction: 'inbound', body_text: body, sent_at: null })
      } else if (type === 'ai') {
        const body = extractAiText(typeof m.content === 'string' ? m.content : null)
        if (!body) continue
        messages.push({ direction: 'outbound', body_text: body, sent_at: null })
      }
    }

    if (!hasHuman) {
      semHuman++
      continue
    }

    const statusFunil = lead.status_funil as string
    rows.push({
      id_conversa: lead.id_conversa,
      status_funil: statusFunil,
      messages,
      expected_intent: LABEL_MAP[statusFunil],
      expected_meeting: {
        has: statusFunil === 'AGENDAMENTO_CONFIRMADO' || !!lead.data_reuniao,
        date: lead.data_reuniao ?? null,
      },
    })
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')

  // Distribuição agregada (sem PII) no stdout.
  const dist: Record<string, number> = {}
  for (const r of rows) dist[r.expected_intent] = (dist[r.expected_intent] || 0) + 1
  const meetingHas = rows.filter((r) => r.expected_meeting.has).length

  console.log(`Dataset salvo em ${OUT_PATH}`)
  console.log(`Conversas no dataset: ${rows.length}`)
  console.log(`Rotuladas ignoradas por não ter resposta do lead: ${semHuman}`)
  console.log(`Distribuição de expected_intent:`, dist)
  console.log(`Conversas com reunião esperada (has=true): ${meetingHas}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
