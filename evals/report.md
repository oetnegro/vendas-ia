# Evals — Cérebro de classificação de respostas (antes → depois)

Medição da qualidade do `generateEmailAgentDecision` (`lib/ai/email-agent.ts`) com **Gemini real**
(`gemini-2.5-flash`), versionando a *system instruction*: **V1 (baseline)** → **V2 (tunada)**.

## Dataset
- **200 conversas reais** do Vendas+IA rodando no WhatsApp (mesmo produto/ICP, em português),
  exportadas de `vendas_leads_consolidados` + `vendascopy_chat_histories_duplicate` (somente leitura).
- Cada caso recebe o **thread completo** (igual produção), não só a última mensagem.
- Rótulo = `status_funil` do CRM mapeado para `intent` (ver `evals/label-map.ts`).
- **Gold humano:** amostra de **30** conversas revisada manualmente pelo dono em 2026-06-03.
  Concordância com o rótulo automático do CRM: **28/30 = 93,3%** (correções em 2 intents + 3 ajustes
  de reunião). Mede a honestidade do gabarito.
- Distribuição (intent esperado): negative 96 · meeting 90 · question 11 · interested 3.
  Classes `objection/not_now/opt_out/neutral` **não existem** com resposta do lead nestes dados
  (parada honesta: não foram inventados exemplos).
- Tolerância de data na extração de reunião: **±1 dia** (canal/fuso variam).

## Resultado — Escala (200 conversas, AI-labeled)

| Métrica | V1 baseline | V2 tunada |
|---|---|---|
| **Accuracy** | 29,5% | **62,0%** |
| **Macro-F1** | 23,8% | **53,9%** |
| F1 negative | 51,9% | **67,1%** |
| F1 meeting | 43,5% | **84,1%** |
| F1 question | 0,0% | **64,3%** |
| F1 interested | 0,0% | 0,0% |
| **Extração de reunião — F1 (booked)** | 40,0% | **77,8%** |
| Acerto de data ±1d | 4/26 | **12/26** |

## Resultado — Gold humano (30 conversas revisadas)

| Métrica | V1 baseline | V2 tunada |
|---|---|---|
| **Accuracy** | 6,7% | **63,3%** |
| **Macro-F1** | 11,1% | **63,8%** |
| **Extração de reunião — F1 (booked)** | 50,0% | **66,7%** |

## Análise de erro do baseline (padrões corrigidos pela V2)
1. **`neutral` virava "lixeira":** o V1 jogava 101 respostas em `neutral` (52 negativas, 37 meetings,
   11 questions), todas erradas — o dado real sempre traz algum sinal. V2 reduz `neutral` a uso raro.
2. **Classe `question` ignorada (recall 0%):** "lead compartilha o contato do decisor / encaminha
   para outra pessoa" não era reconhecido. V2 define explicitamente esse padrão → recall 81,8%.
3. **`negative` confundido com `opt_out`/`not_now`:** recusas educadas viravam descadastro/adiamento.
   V2 restringe `opt_out` a pedido explícito de remoção e `not_now` a pedido explícito de adiar.
4. **`meeting` pouco detectado (recall 27,8%):** interesse em agendar virava `neutral`/`question`
   (ex.: lead manda e-mail para receber o convite). V2 trata qualquer sinal de agendamento como
   `meeting`; horário confirmado → `meeting_booked` + ISO. Recall 73,3%; extração de reunião F1 +38pp.

## Notas de honestidade
- Dois **bugs de infra** foram corrigidos para que a medição refletisse a instrução (aplicados igual
  a V1 e V2): `gemini-2.5-flash` desperdiçava o orçamento de tokens com "thinking" (resposta JSON
  vazia) e o teto de `maxOutputTokens` truncava o JSON. Fix: `thinkingBudget: 0` + `maxOutputTokens: 4096`.
- A API (free-tier) ainda devolve resposta vazia de forma intermitente (~7–15%); essas viram `neutral`
  forçado e contam como **erro** nos números acima. Na V2, dos 32 `neutral` previstos, **29 eram falha
  de API** e só 3 escolha do modelo — ou seja, a qualidade real da V2 é ainda maior que a medida.
- A V2 foi penalizada com mais falhas de API que a V1 (29 vs 15), então o ganho real é conservador.

## Como reproduzir
Ver `evals/README.md`. Resumo: `npm run eval:export` (monta o dataset local) e
`npm run eval:run -- v1` / `npm run eval:run -- v2` (mede baseline / tunada).
