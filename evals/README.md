# Evals — Cérebro de classificação de respostas

Mede a qualidade do `generateEmailAgentDecision` (`lib/ai/email-agent.ts`) sobre conversas **reais**
do Vendas+IA (WhatsApp), comparando a *system instruction* **antes (V1)** e **depois (V2)** do tuning.

Sem framework de eval — runner próprio, sem dependências novas. Roda em Node 24 (TypeScript nativo).

## Privacidade (importante)
- O dataset (`evals/datasets/`) contém conversas/telefones reais (PII) e está **no `.gitignore`**.
  **Nunca** commite nada de `datasets/`.
- Só vão para o Git: o **código** (`*.ts`), o **gabarito** (`label-map.ts`) e os **relatórios
  agregados** (`report.md`, `report_v1.md`, `report_v2.md`) — apenas números, sem PII.

## Pré-requisitos
- `.env.local` na raiz com `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `GEMINI_API_KEY`.
- Node 24+ (usa `--env-file` e type-stripping nativo).

## Passos
1. **Exportar o dataset** (somente leitura das tabelas legadas):
   ```bash
   npm run eval:export
   ```
   Gera `evals/datasets/whatsapp_labeled.jsonl` (~200 conversas) e imprime a distribuição de rótulos.

2. **(Opcional) Amostra para revisão humana** do gabarito:
   ```bash
   node evals/review-sample.ts        # amostra estratificada ~30
   node evals/review-sample.ts full   # todas
   ```
   A saída contém PII — não redirecionar para arquivo versionado. As correções humanas ficam em
   `evals/datasets/human-gold.json` (local, gitignored).

3. **Rodar a medição** (Gemini real, sequencial para evitar respostas vazias por rate-limit):
   ```bash
   npm run eval:run -- v1   # baseline (system instruction V1)
   npm run eval:run -- v2   # tunada (V2)
   ```
   Cada rodada gera `evals/report_<tag>.md` e cacheia decisões em `evals/datasets/decisions_<tag>.json`.
   Use `-- v2 --reuse` para reusar o cache (não chama a API de novo).

## Metodologia (travada)
- O classificador recebe o **thread completo**, igual produção.
- O rótulo é a intenção/ação correta dado o thread inteiro (não só a última mensagem).
- Reunião: `booked = true` quando há horário confirmado (ISO preenchido). "Interesse em agendar" sem
  horário = `meeting` + `booked=false`. Tolerância de data: **±1 dia**.
- Métricas: precision/recall/F1 por classe + macro, accuracy, matriz de confusão; e F1 da extração de
  reunião (acerto de `booked` + acerto de data dentro da tolerância).

## Versionar a instrução (reverter)
A *system instruction* vive em `lib/ai/email-agent.ts` como `EMAIL_AGENT_INSTRUCTION_V1` (baseline) e
`EMAIL_AGENT_INSTRUCTION_V2` (tunada, default em produção). Selecione com
`EMAIL_AGENT_PROMPT_VERSION=v1|v2`. Para reverter o tuning, basta apontar produção para `v1`.

Resultados consolidados: ver [`report.md`](./report.md).
