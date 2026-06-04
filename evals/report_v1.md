# Evals — cérebro de classificação (V1)

Gerado: 2026-06-04T01:39:26.617Z · modelo: gemini-2.5-flash · prompt: v1

Dataset: 200 conversas reais do Vendas+IA (WhatsApp), thread completo. Gold humano: 28/30 concordância (93.3%).

### Gold humano (n=30)

**Classificação de resposta** — accuracy geral: **6.7%** · macro-F1: **11.1%**

| classe | precision | recall | F1 | suporte |
|---|---|---|---|---|
| question | 0.0% | 0.0% | 0.0% | 11 |
| meeting | 100.0% | 12.5% | 22.2% | 8 |
| negative | 33.3% | 16.7% | 22.2% | 6 |
| interested | 0.0% | 0.0% | 0.0% | 5 |

**Extração de reunião** — F1 (booked): **50.0%** · precision 100.0% · recall 33.3% · accuracy 86.7%
(tp=2 fp=0 fn=4 tn=24; acerto de data ±1d: 0/1)

Matriz de confusão (linha=gold, coluna=previsto):

| gold ↓ / prev → | neutral | question | negative | not_now | meeting | opt_out |
|---|---|---|---|---|---|---|
| interested | 1 | 2 | 1 | 1 | 0 | 0 |
| question | 11 | 0 | 0 | 0 | 0 | 0 |
| meeting | 4 | 2 | 1 | 0 | 1 | 0 |
| negative | 3 | 0 | 1 | 1 | 0 | 1 |

### Escala (AI-labeled) (n=200)

**Classificação de resposta** — accuracy geral: **29.5%** · macro-F1: **23.8%**

| classe | precision | recall | F1 | suporte |
|---|---|---|---|---|
| negative | 97.1% | 35.4% | 51.9% | 96 |
| meeting | 100.0% | 27.8% | 43.5% | 90 |
| question | 0.0% | 0.0% | 0.0% | 11 |
| interested | 0.0% | 0.0% | 0.0% | 3 |

**Extração de reunião** — F1 (booked): **40.0%** · precision 60.0% · recall 30.0% · accuracy 82.0%
(tp=12 fp=8 fn=28 tn=152; acerto de data ±1d: 4/26)

Matriz de confusão (linha=gold, coluna=previsto):

| gold ↓ / prev → | meeting | negative | question | neutral | not_now | interested | opt_out |
|---|---|---|---|---|---|---|---|
| meeting | 25 | 1 | 19 | 40 | 4 | 1 | 0 |
| negative | 0 | 34 | 2 | 41 | 5 | 0 | 14 |
| interested | 0 | 0 | 2 | 1 | 0 | 0 | 0 |
| question | 0 | 0 | 0 | 11 | 0 | 0 | 0 |

Erros de classificação (escala) salvos em datasets/errors_v1.json — 141 casos.
