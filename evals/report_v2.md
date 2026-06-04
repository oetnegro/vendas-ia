# Evals — cérebro de classificação (V2)

Gerado: 2026-06-04T02:09:28.821Z · modelo: gemini-2.5-flash · prompt: v2

Dataset: 200 conversas reais do Vendas+IA (WhatsApp), thread completo. Gold humano: 28/30 concordância (93.3%).

### Gold humano (n=30)

**Classificação de resposta** — accuracy geral: **63.3%** · macro-F1: **63.8%**

| classe | precision | recall | F1 | suporte |
|---|---|---|---|---|
| question | 81.8% | 81.8% | 81.8% | 11 |
| meeting | 85.7% | 75.0% | 80.0% | 8 |
| negative | 75.0% | 50.0% | 60.0% | 6 |
| interested | 100.0% | 20.0% | 33.3% | 5 |

**Extração de reunião** — F1 (booked): **66.7%** · precision 100.0% · recall 50.0% · accuracy 90.0%
(tp=3 fp=0 fn=3 tn=24; acerto de data ±1d: 1/1)

Matriz de confusão (linha=gold, coluna=previsto):

| gold ↓ / prev → | neutral | question | interested | meeting | negative | opt_out |
|---|---|---|---|---|---|---|
| interested | 2 | 2 | 1 | 0 | 0 | 0 |
| question | 1 | 9 | 0 | 1 | 0 | 0 |
| meeting | 1 | 0 | 0 | 6 | 1 | 0 |
| negative | 2 | 0 | 0 | 0 | 3 | 1 |

### Escala (AI-labeled) (n=200)

**Classificação de resposta** — accuracy geral: **62.0%** · macro-F1: **53.9%**

| classe | precision | recall | F1 | suporte |
|---|---|---|---|---|
| negative | 98.0% | 51.0% | 67.1% | 96 |
| meeting | 98.5% | 73.3% | 84.1% | 90 |
| question | 52.9% | 81.8% | 64.3% | 11 |
| interested | 0.0% | 0.0% | 0.0% | 3 |

**Extração de reunião** — F1 (booked): **77.8%** · precision 87.5% · recall 70.0% · accuracy 92.0%
(tp=28 fp=4 fn=12 tn=156; acerto de data ±1d: 12/26)

Matriz de confusão (linha=gold, coluna=previsto):

| gold ↓ / prev → | meeting | negative | neutral | objection | question | interested | not_now | opt_out |
|---|---|---|---|---|---|---|---|---|
| meeting | 66 | 1 | 3 | 2 | 5 | 11 | 2 | 0 |
| negative | 0 | 49 | 27 | 0 | 1 | 1 | 2 | 16 |
| interested | 0 | 0 | 1 | 0 | 2 | 0 | 0 | 0 |
| question | 1 | 0 | 1 | 0 | 9 | 0 | 0 | 0 |

Erros de classificação (escala) salvos em datasets/errors_v2.json — 76 casos.
