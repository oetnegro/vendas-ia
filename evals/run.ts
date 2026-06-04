// Runner de evals do cérebro de classificação (lib/ai/email-agent.ts → generateEmailAgentDecision).
// Usa Gemini REAL. Mede contra dois conjuntos: gold humano (~30) e escala (~200 AI-labeled).
//
// Uso:
//   node --env-file=.env.local evals/run.ts v1   # baseline (system instruction V1)
//   node --env-file=.env.local evals/run.ts v2   # tunada (V2)
// (npm run eval:run -- v1)
//
// METODOLOGIA (travada):
//  - O classificador recebe o THREAD COMPLETO (igual produção), não só a última mensagem.
//  - O rótulo é a intenção/ação correta dado o thread inteiro.
//  - Reunião: booked = horário confirmado (meeting_start_iso preenchido). "interesse em
//    agendar" sem horário = meeting + booked=false. Tolerância de data: ±1 dia.
//  - Sem fallback local: medimos só o modelo real.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateEmailAgentDecision, type EmailAgentDecision } from '../lib/ai/email-agent.ts'
import type { DatasetRow } from './export-dataset.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATASET = resolve(__dirname, 'datasets/whatsapp_labeled.jsonl')
// gold humano contém ids (telefones = PII) → fica em datasets/ (gitignored)
const HUMAN_GOLD = resolve(__dirname, 'datasets/human-gold.json')

const TAG = process.argv[2] === 'v1' ? 'v1' : process.argv[2] === 'v2' ? 'v2' : 'v2'
process.env.EMAIL_AGENT_PROMPT_VERSION = TAG
const DECISIONS_CACHE = resolve(__dirname, `datasets/decisions_${TAG}.json`)
const REUSE = process.argv.includes('--reuse')

const AGENT = {
  name: 'Vendas+IA',
  business_context:
    'Vendas+IA é uma plataforma de prospecção B2B com um SDR de IA que conversa com leads por WhatsApp/e-mail, qualifica e agenda reuniões de demonstração.',
  campaign_goal: 'Agendar uma reunião de demonstração qualificada com o lead.',
  common_objections: 'Falta de tempo, já possui solução, dúvida sobre preço, pede para falar com outra pessoa.',
}
const LEAD = { email: 'lead@exemplo.com', first_name: null, last_name: null, company: null, title: null, custom_fields: {} }

type Labeled = { id: string; intent: string; has: boolean; date: string | null }
type Decision = { id: string; intent: string; booked: boolean; iso: string | null; action: string; summary?: string; reasoning?: string }

function loadDataset(): DatasetRow[] {
  return readFileSync(DATASET, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
}

// ---- execução do modelo (concorrência + retry em erro) ----
async function runModel(rows: DatasetRow[]): Promise<Map<string, Decision>> {
  if (REUSE && existsSync(DECISIONS_CACHE)) {
    const cached: Decision[] = JSON.parse(readFileSync(DECISIONS_CACHE, 'utf8'))
    console.log(`Reusando ${cached.length} decisões de ${DECISIONS_CACHE}`)
    return new Map(cached.map((d) => [d.id, d]))
  }
  const out = new Map<string, Decision>()
  const queue = [...rows]
  let done = 0
  const CONCURRENCY = 1

  async function decideOne(row: DatasetRow): Promise<Decision> {
    const messages = row.messages.map((m) => ({
      direction: m.direction,
      subject: null,
      body_text: m.body_text,
      sent_at: m.sent_at,
    }))
    // gemini-2.5-flash às vezes devolve JSON vazio (~1/3). Retry agressivo p/ medição limpa.
    let last: EmailAgentDecision | null = null
    for (let attempt = 0; attempt < 6; attempt++) {
      const d = await generateEmailAgentDecision({ agent: AGENT, lead: LEAD, messages })
      last = d
      const looksError = d.action === 'skip' && /falha|erro|invalido|inválid/i.test(d.reasoning || '')
      if (!looksError) break
      await new Promise((r) => setTimeout(r, Math.min(8000, 1000 * 2 ** attempt)))
    }
    const d = last as EmailAgentDecision
    return {
      id: row.id_conversa,
      intent: d.intent,
      booked: !!d.meeting_start_iso,
      iso: d.meeting_start_iso ?? null,
      action: d.action,
      summary: d.summary,
      reasoning: d.reasoning,
    }
  }

  async function worker() {
    while (queue.length) {
      const row = queue.shift()!
      const d = await decideOne(row)
      out.set(d.id, d)
      done++
      if (done % 20 === 0) console.log(`  ${done}/${rows.length} decisões...`)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  writeFileSync(DECISIONS_CACHE, JSON.stringify([...out.values()], null, 2))
  return out
}

// ---- métricas ----
function classMetrics(gold: Labeled[], dec: Map<string, Decision>) {
  const classes = Array.from(new Set([...gold.map((g) => g.intent), ...gold.map((g) => dec.get(g.id)?.intent || 'MISSING')]))
  const counts: Record<string, { tp: number; fp: number; fn: number }> = {}
  for (const c of classes) counts[c] = { tp: 0, fp: 0, fn: 0 }
  const confusion: Record<string, Record<string, number>> = {}
  let correct = 0
  for (const g of gold) {
    const p = dec.get(g.id)?.intent || 'MISSING'
    confusion[g.intent] ||= {}
    confusion[g.intent][p] = (confusion[g.intent][p] || 0) + 1
    if (p === g.intent) {
      correct++
      counts[g.intent].tp++
    } else {
      counts[g.intent].fn++
      counts[p] ||= { tp: 0, fp: 0, fn: 0 }
      counts[p].fp++
    }
  }
  const perClass: Record<string, { precision: number; recall: number; f1: number; support: number }> = {}
  const goldClasses = Array.from(new Set(gold.map((g) => g.intent)))
  let macroF1 = 0
  for (const c of goldClasses) {
    const { tp, fp, fn } = counts[c]
    const precision = tp + fp ? tp / (tp + fp) : 0
    const recall = tp + fn ? tp / (tp + fn) : 0
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
    perClass[c] = { precision, recall, f1, support: tp + fn }
    macroF1 += f1
  }
  macroF1 /= goldClasses.length
  return { perClass, macroF1, accuracy: correct / gold.length, confusion, n: gold.length }
}

function meetingMetrics(gold: Labeled[], dec: Map<string, Decision>) {
  let tp = 0, fp = 0, fn = 0, tn = 0
  let dateTotal = 0, dateOk = 0
  for (const g of gold) {
    const p = dec.get(g.id)
    const predBooked = !!p?.booked
    if (g.has && predBooked) tp++
    else if (!g.has && predBooked) fp++
    else if (g.has && !predBooked) fn++
    else tn++
    if (g.has && g.date) {
      dateTotal++
      if (p?.iso) {
        const gd = new Date(g.date).getTime()
        const pd = new Date(p.iso).getTime()
        if (Math.abs(gd - pd) <= 36 * 3600 * 1000) dateOk++ // ±1 dia (36h de folga p/ fuso)
      }
    }
  }
  const precision = tp + fp ? tp / (tp + fp) : 0
  const recall = tp + fn ? tp / (tp + fn) : 0
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
  const accuracy = (tp + tn) / gold.length
  return { precision, recall, f1, accuracy, tp, fp, fn, tn, dateTotal, dateOk, n: gold.length }
}

// ---- relatório ----
function fmt(n: number) { return (n * 100).toFixed(1) + '%' }

function renderBlock(title: string, cm: ReturnType<typeof classMetrics>, mm: ReturnType<typeof meetingMetrics>) {
  let s = `### ${title} (n=${cm.n})\n\n`
  s += `**Classificação de resposta** — accuracy geral: **${fmt(cm.accuracy)}** · macro-F1: **${fmt(cm.macroF1)}**\n\n`
  s += `| classe | precision | recall | F1 | suporte |\n|---|---|---|---|---|\n`
  for (const [c, m] of Object.entries(cm.perClass).sort((a, b) => b[1].support - a[1].support)) {
    s += `| ${c} | ${fmt(m.precision)} | ${fmt(m.recall)} | ${fmt(m.f1)} | ${m.support} |\n`
  }
  s += `\n**Extração de reunião** — F1 (booked): **${fmt(mm.f1)}** · precision ${fmt(mm.precision)} · recall ${fmt(mm.recall)} · accuracy ${fmt(mm.accuracy)}\n`
  s += `(tp=${mm.tp} fp=${mm.fp} fn=${mm.fn} tn=${mm.tn}; acerto de data ±1d: ${mm.dateOk}/${mm.dateTotal})\n\n`
  s += `Matriz de confusão (linha=gold, coluna=previsto):\n\n`
  const cols = Array.from(new Set(Object.values(cm.confusion).flatMap((r) => Object.keys(r))))
  s += `| gold ↓ / prev → | ${cols.join(' | ')} |\n|${'---|'.repeat(cols.length + 1)}\n`
  for (const [g, row] of Object.entries(cm.confusion)) {
    s += `| ${g} | ${cols.map((c) => row[c] || 0).join(' | ')} |\n`
  }
  return s + '\n'
}

async function main() {
  const dataset = loadDataset()
  const humanGold = JSON.parse(readFileSync(HUMAN_GOLD, 'utf8'))
  const byId = new Map(dataset.map((r) => [r.id_conversa, r]))

  // conjunto escala (200)
  const scaleGold: Labeled[] = dataset.map((r) => ({
    id: r.id_conversa, intent: r.expected_intent, has: r.expected_meeting.has, date: r.expected_meeting.date ?? null,
  }))

  // conjunto humano (30, com overrides)
  const humanGoldSet: Labeled[] = (humanGold.reviewed_ids as string[]).map((id) => {
    const base = byId.get(id)!
    const ov = humanGold.overrides[id] || {}
    return {
      id,
      intent: ov.expected_intent ?? base.expected_intent,
      has: ov.expected_meeting?.has ?? base.expected_meeting.has,
      date: ov.expected_meeting?.date ?? base.expected_meeting.date ?? null,
    }
  })

  console.log(`[${TAG}] Rodando modelo sobre ${dataset.length} conversas (thread completo)...`)
  const dec = await runModel(dataset)

  const humanCM = classMetrics(humanGoldSet, dec)
  const humanMM = meetingMetrics(humanGoldSet, dec)
  const scaleCM = classMetrics(scaleGold, dec)
  const scaleMM = meetingMetrics(scaleGold, dec)

  // erros (agrupáveis) — salva detalhe para análise (sem PII além do id já no CRM)
  const errors = scaleGold
    .filter((g) => (dec.get(g.id)?.intent || 'MISSING') !== g.intent)
    .map((g) => ({ id: g.id, gold: g.intent, pred: dec.get(g.id)?.intent, action: dec.get(g.id)?.action }))
  writeFileSync(resolve(__dirname, `datasets/errors_${TAG}.json`), JSON.stringify(errors, null, 2))

  const report =
    `# Evals — cérebro de classificação (${TAG.toUpperCase()})\n\n` +
    `Gerado: ${new Date().toISOString()} · modelo: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'} · prompt: ${TAG}\n\n` +
    `Dataset: ${dataset.length} conversas reais do Vendas+IA (WhatsApp), thread completo. ` +
    `Gold humano: ${humanGold.agreement.agreed}/${humanGold.agreement.n} concordância (${fmt(humanGold.agreement.rate)}).\n\n` +
    renderBlock('Gold humano', humanCM, humanMM) +
    renderBlock('Escala (AI-labeled)', scaleCM, scaleMM) +
    `Erros de classificação (escala) salvos em datasets/errors_${TAG}.json — ${errors.length} casos.\n`

  writeFileSync(resolve(__dirname, `report_${TAG}.md`), report)
  console.log(`\n=== [${TAG}] RESUMO ===`)
  console.log(`Gold humano (n=${humanCM.n}): acc ${fmt(humanCM.accuracy)} · macroF1 ${fmt(humanCM.macroF1)} · meetingF1 ${fmt(humanMM.f1)}`)
  console.log(`Escala (n=${scaleCM.n}): acc ${fmt(scaleCM.accuracy)} · macroF1 ${fmt(scaleCM.macroF1)} · meetingF1 ${fmt(scaleMM.f1)}`)
  console.log(`Relatório: evals/report_${TAG}.md · erros: datasets/errors_${TAG}.json (${errors.length})`)
}

main().catch((e) => { console.error(e); process.exit(1) })
