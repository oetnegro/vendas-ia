# HACKATHON.md — Dossiê de submissão (Google for Startups AI Agents Challenge)

> Documento vivo. Cada sessão de épico atualiza este arquivo ao terminar. No dia da submissão (5/jun), os campos abaixo viram o texto do Devpost.

## Dados da submissão

- **Desafio:** Google for Startups AI Agents Challenge
- **Deadline:** 5/jun/2026, 21h BRT (17h PT)
- **Track:** Track 1 — Build (Net-New Agents)
- **Região:** AMERS
- **Critérios:** Technical 30% · Business 30% · Innovation 20% · Demo 20%
- **Produto:** Vendas+IA Email Prospecting
- **Posicionamento:** "O coach de vendas pra quem nunca vendeu — começa pelo email, fecha por reunião." ICP: SaaS founders, vibe coders e devs que precisam dos primeiros clientes B2B.

## Entregáveis exigidos (checklist)

- [x] Código (repo acessível) — privado: dar acesso de teste aos juízes ou tornar público no dia da submissão
- [ ] Vídeo de demo (~3 min)
- [ ] Diagrama de arquitetura
- [ ] Acesso de teste (link/demo/build, com login se privado)
- [ ] Texto Devpost (business / technical / innovation / demo)

## Tecnologias obrigatórias / pontos do Google (checklist de regra)

- [ ] **Gemini** — usado no cérebro do agente (classificação, resposta, extração de reunião) e no enrichment (NL → params)
- [ ] **ADK (Agent Development Kit)** — agente Python no Cloud Run (reply: classify → meeting → calendar → reply)
- [ ] **MCP (Model Context Protocol)** — duas pontas:
  - [x] PUBLICADO: Vendas+IA como MCP server (cliente opera via Claude/Codex/Cursor) — rota Streamable HTTP em `/api/mcp`, auth por token de workspace, 9 tools (read/write), auditoria `mcp:` em activity_logs. Validado localhost.
  - CONSUMIDO: agente usa ferramentas externas (Apify, Gmail, Calendar)
- [ ] **Google Cloud Run** — hospeda ADK + MCP server
- [ ] **Cloud Scheduler** — substitui n8n no agendamento do cron
- [ ] **Cloud Logging** — traces do agente (alimentam os evals)

## Arquitetura (resumo)

App web (Next.js, Vercel) + Claude/Codex/Cursor → **MCP server (TS, Cloud Run)** → engine de cadência (TS, determinística, mantém o piloto) + **agente ADK (Python, Cloud Run)** que classifica respostas, extrai reunião e agenda no Calendar usando ferramentas. Dados em Supabase multi-tenant (RLS). Agendamento via Cloud Scheduler. Traces em Cloud Logging.

> Decisão de hospedagem: HÍBRIDO no hackathon (web na Vercel; agente/MCP no Google Cloud). Migração total para GCP fica como roadmap pós-lançamento (usando créditos GCP Startups).

_[colar diagrama aqui no dia 4]_

## Business case (rascunho)

- **Problema:** explosão de vibe coders / micro-SaaS lançando produtos sem saber conseguir os primeiros clientes; não têm time comercial nem sabem fazer outbound.
- **Solução:** agente autônomo que descobre ICP, acha leads (enrichment caixa-preta), escreve cadência, envia, lê respostas, classifica e agenda reunião — operável por linguagem natural via Claude/Codex (MCP).
- **Prova:** piloto interno real rodando (não é protótipo). Métricas: _[preencher: leads contatados, % resposta, reuniões agendadas]_
- **Mercado:** milhões de builders globalmente; pronto para Google Cloud Marketplace.

## Métricas de evals (preencher no dia 2)

- Reply classification — precision/recall antes → depois do tuning: _[__ % → __ %]_
- Meeting extraction — F1 antes → depois: _[__ → __]_

## Links (preencher)

- Repo: https://github.com/oetnegro/vendas-ia (PRIVADO — dar acesso de teste aos juízes ou tornar público no dia da submissão)
- Vídeo: _[url]_
- Demo / acesso de teste: _[url + credenciais se privado]_

## Log por épico (atualizar ao fim de cada sessão)

| Data | Épico | Status | O que entregou (1 linha) |
|---|---|---|---|
| 2026-05-29 | 1.6 Onboarding OAuth end-to-end | ✅ | Wizard reordenado (Agente→Gmail), callback roteia novo vs. retornante, redirect_to funcional no OAuth Google, onboarding_step persistido no DB, erros humanizados |
| 2026-05-29 | Enrichment Apify | ✅ | ICP form pré-preenchido do agente → Gemini escolhe actor dinamicamente da allowlist → Apify roda async → preview de leads (valid/guessed/sem email) → importa com dedupe e quota; "Apify" nunca aparece na UI |
| 2026-06-01 | ADK reply-agent | 🟡 | Serviço Python ADK 2.1 + Gemini em `services/adk-agent/` (classify→meeting→reply com tools), endpoint FastAPI autenticado, `EmailAgentDecision` 1:1; integração TS atrás da flag `USE_ADK_REPLY` com fallback automático; traces estruturados p/ Cloud Logging. Validado localhost (meeting/opt-out/negative + auth). Deploy Cloud Run pendente (gcloud/Docker ausentes nesta máquina) — Dockerfile + deploy.sh prontos |
| 2026-06-01 | MCP server (publicado) | ✅ | Vendas+IA publicado como MCP server (Streamable HTTP em `/api/mcp`, SDK oficial); auth por token de workspace (sha256, scopes read/write/send, rate limit, revogável); 9 tools (list_campaigns, get_campaign, get_funnel_stats, list_recent_replies, list_leads, create_campaign_draft, enrich_leads, pause/resume_campaign); toda ação auditada com prefixo `mcp:`; UI em /settings/integrations gera/revoga tokens; nenhuma tool envia e-mail. Validado localhost end-to-end |
| 2026-06-01 | Git + GitHub | ✅ | Projeto versionado com git e enviado ao repo PRIVADO oetnegro/vendas-ia; .gitignore reforçado (.claude/, CSV de leads, exceção p/ .env.example); auditoria confirmou zero segredos no remoto |
| | Cloud Run + Scheduler | | |
| | Evals | | |
| | Tracking open/click | | |
