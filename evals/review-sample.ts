// Gera amostra estratificada para REVISÃO HUMANA do gabarito.
// Mostra a última resposta REAL do lead + o rótulo esperado, para o dono confirmar/corrigir.
// Imprime no stdout (contém PII — não redirecionar para arquivo versionado).
// Rodar: node evals/review-sample.ts

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DatasetRow } from './export-dataset.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rows: DatasetRow[] = readFileSync(resolve(__dirname, 'datasets/whatsapp_labeled.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))

// Modo: "node review-sample.ts full" lista TODAS; sem arg = amostra estratificada ~30.
const FULL = process.argv.includes('full')
const quota: Record<string, number> = { interested: 3, question: 11, meeting: 8, negative: 8 }
const byClass: Record<string, DatasetRow[]> = {}
for (const r of rows) (byClass[r.expected_intent] ||= []).push(r)

// Para revisão pelo dono mostramos o id completo (telefone). NUNCA versionar esta saída.
function maskId(id: string) {
  return id
}
function lastInbound(r: DatasetRow) {
  const inb = [...r.messages].reverse().find((m) => m.direction === 'inbound')
  return (inb?.body_text || '').replace(/\s+/g, ' ').slice(0, 220)
}

let n = 0
const classes = FULL ? Object.keys(byClass) : Object.keys(quota)
for (const cls of classes) {
  const items = FULL ? byClass[cls] || [] : (byClass[cls] || []).slice(0, quota[cls])
  console.log(`\n===== esperado=${cls} (${items.length}) =====`)
  for (const r of items) {
    n++
    console.log(`#${n} [${maskId(r.id_conversa)}]` + (r.expected_meeting.has ? ` | reunião=SIM` : ``))
    console.log(`   lead: "${lastInbound(r)}"`)
  }
}
console.log(`\nTotal listado: ${n}`)
