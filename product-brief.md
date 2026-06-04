# Product Brief — Vendas+IA Email Prospecting App

> Documento de contexto permanente para agentes. Atualizar sempre que uma mudança relevante de produto, arquitetura, banco, fluxo ou decisão técnica for aplicada.

---

## Propósito Do Documento

Este brief serve para orientar outro agente ou desenvolvedor a continuar o produto sem depender do histórico da conversa.

Ele deve explicar:

- O que estamos construindo.
- O que já foi implementado.
- Quais decisões de produto e arquitetura estão fechadas.
- Onde estão os arquivos principais.
- Como testar localmente.
- O que ainda falta.
- Quais cuidados não podem ser esquecidos.

O brief da landing pública continua em `landing-page-brief.md`. Este arquivo é específico do app self-service de prospecção por e-mail.

---

## Produto

**Nome atual de trabalho**: Vendas+IA Email Prospecting App  
**Domínio planejado**: `app.vendasmaisia.com`  
**Landing atual**: `https://www.vendasmaisia.com`  
**Repo/workspace atual**: `/Users/lucasdpaula/vendas-ia-landing`  
**Projeto Vercel atual da landing**: `vendas-ia-landing`  
**Supabase project_ref**: `owvxhedtkpcfiygkvudl`

### O Que Faz

Produto self-service para prospecção outbound por e-mail usando a conta Google do próprio usuário.

Fluxo desejado:

1. Usuário cria conta.
2. Cria/configura workspace e agente.
3. Treina a IA com contexto do negócio, ICP, proposta de valor, objeções comuns, objetivo da campanha e tom de voz.
4. Importa leads por CSV.
5. Conecta Gmail + Google Calendar.
6. Cria campanha com volume saudável e janela de envio.
7. Recebe sugestões de cadência/templates.
8. Edita e aprova tudo.
9. Engine executa envios aprovados, lê respostas, classifica conversas e agenda reunião quando há horário claro.

---

## Decisões Fechadas

- Landing fica no domínio principal.
- App deve ficar em projeto/domínio separado: `app.vendasmaisia.com`.
- MVP interno usa Google OAuth: Gmail + Google Calendar.
- Para venda pública, provedores iniciais devem ser Gmail e Outlook/Microsoft 365. IMAP/SMTP genérico fica fora do v1.
- Envio será pelo Gmail do próprio usuário.
- Leads entram por CSV no MVP.
- IA ajuda a criar abordagem, cadências, templates e horários.
- Usuário aprova mensagens/cadências antes de qualquer envio.
- Billing Stripe e Outlook entram antes da venda pública, depois do piloto interno real.
- n8n pode operar o scheduler externo do MVP enquanto o projeto Vercel estiver no plano Hobby.
- Quando o projeto migrar para Vercel Pro, o scheduler deve ser movido para Vercel Cron subdiário e o n8n deve deixar de ser necessário para esta rotina.
- Banco novo deve ser multi-tenant real com `workspace_id`, não tabela por cliente.
- Compliance básico obrigatório: unsubscribe/opt-out, limites diários, logs e pausa.
- `opted_out` é compliance interno. A UI comercial de funil usa `negative`/`Negativos` para recusas e descadastros agregados.
- A landing existente deve continuar intacta.

---

## Estado Atual Do Repo

Este repo começou como landing page pública de WhatsApp/SDR. Agora também contém uma primeira versão do app autenticado em rotas separadas.

### Landing Existente

Mantida em:

- `app/page.tsx`
- `app/layout.tsx`
- `app/sobre/page.tsx`
- `app/privacidade/page.tsx`
- `app/api/contato/route.ts`
- `landing-page-brief.md`

Não alterar a landing sem pedido explícito.

### App Self-Service

Rotas novas:

- `/login`
- `/signup`
- `/callback`
- `/inbox`
- `/dashboard`
- `/onboarding`
- `/leads`
- `/leads/import`
- `/campaigns`
- `/campaigns/new`
- `/campaigns/[id]/cadence`
- `/campaigns/[id]/review`
- `/settings/google`

API nova:

- `/api/templates/leads-csv`
- `/api/auth/google/callback`
- `/api/campaigns/approve`
- `/api/email/send-test`
- `/api/email/send-template-test`
- `/api/email/sync`
- `/api/cron/email-engine`

---

## Arquitetura Atual

### Stack

- Next.js 16 App Router.
- React 19.
- Tailwind CSS 4.
- Supabase Auth + Supabase Postgres.
- Supabase MCP configurado, mas a sessão atual respondeu `Auth required` ao tentar aplicar migrations.
- Cliente Supabase browser com publishable key.

### Supabase Env Local

`.env.local` usa:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `RESEND_API_KEY`
- `NOTIFICATION_EMAIL`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_PROVIDER=gemini`
- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-2.5-flash`
- `CRON_SECRET`
- `AI_REPLY_MIN_AGE_MINUTES=3`
- `AI_DAILY_EMAIL_LIMIT_PER_WORKSPACE=80`
- `AI_ENGINE_MAX_CONNECTIONS_PER_RUN=10`
- `AI_ENGINE_MAX_THREADS_PER_WORKSPACE=25`
- `AI_ENGINE_MAX_REPLIES_PER_WORKSPACE_RUN=5`

Nunca usar `SUPABASE_SERVICE_ROLE_KEY` no browser. Ela deve existir apenas em `.env.local` e no ambiente server-side da Vercel.

`GEMINI_API_KEY` tambem deve existir apenas no server-side/local env. O cliente final nao informa chave propria: a IA do produto usa a chave do produto para todos os workspaces, respeitando contexto, workspace e Gmail conectado do usuario.

Vercel envs criadas nesta fase:

- Production: `AI_PROVIDER`, `GEMINI_MODEL`, `GEMINI_API_KEY`, `CRON_SECRET`, `AI_REPLY_MIN_AGE_MINUTES`, `AI_DAILY_EMAIL_LIMIT_PER_WORKSPACE`, `AI_ENGINE_MAX_CONNECTIONS_PER_RUN`, `AI_ENGINE_MAX_THREADS_PER_WORKSPACE`, `AI_ENGINE_MAX_REPLIES_PER_WORKSPACE_RUN`.
- Development: variáveis não-secretas da engine (`AI_PROVIDER`, `GEMINI_MODEL`, limites).
- Preview: pendente para as novas variáveis porque o projeto Vercel exigiu branch explícita ao usar CLI.

Importante: `NEXT_PUBLIC_SUPABASE_ANON_KEY` deve ser uma chave pública (`sb_publishable_...` ou anon JWT), nunca `sb_secret_...`. O uso de secret key no browser causou erro:

```txt
Forbidden use of secret API key in browser
```

Isso já foi corrigido localmente.

---

## Banco De Dados

Migration aplicada no Supabase via MCP:

```txt
20260505235618_phase_1_multi_tenant
google_oauth_connection_flow
```

Arquivos locais:

```txt
supabase/migrations/20260505000000_phase_1_multi_tenant.sql
supabase/migrations/20260506000000_google_oauth_connection_flow.sql
supabase/migrations/20260506010000_google_connection_status_and_disconnect.sql
supabase/migrations/20260506020000_email_threads_ai_toggle.sql
```

Tabelas criadas para o app novo:

- `workspaces`
- `workspace_members`
- `google_connections`
- `google_oauth_states`
- `agents`
- `campaigns`
- `cadence_steps`
- `leads`
- `email_threads`
- `email_messages`
- `send_jobs`
- `opt_outs`
- `activity_logs`

Todas as tabelas novas foram validadas com RLS ativo.

### Modelo Multi-Tenant

O isolamento do app novo depende de:

- `workspace_id` em todas as entidades operacionais.
- `workspace_members.user_id = auth.uid()`.
- Função `public.is_workspace_member(workspace_id)`.
- Policies RLS por workspace.

Não usar tabelas antigas por prefixo de cliente para este produto.

---

## Fluxos Implementados

### Auth

Arquivos:

- `components/auth/auth-form.tsx`
- `components/auth/auth-guard.tsx`
- `app/(auth)/login/page.tsx`
- `app/(auth)/signup/page.tsx`
- `app/(auth)/callback/page.tsx`

Funcionalidades:

- Login e signup por e-mail/senha.
- Login Google via Supabase Auth básico.
- Auth guard client-side para proteger rotas do app.

Observação: ainda não há auth server-side/cookie robusta. Para OAuth Gmail/Calendar real, será necessário melhorar esse ponto.

### App Shell

Arquivo:

- `components/app/app-shell.tsx`

Padrão visual inspirado no `vendas-ai-app`:

- Topbar azul/slate.
- Acento dourado `#F4D58D`.
- Logo Vendas+IA.
- Navegação horizontal: Dashboard, Agente, Leads, Campanhas, Google.
- Switcher de workspace quando houver mais de um workspace.

### Workspace Hook

Arquivo:

- `lib/use-workspace.ts`

Responsável por:

- Buscar memberships do usuário.
- Buscar workspaces.
- Selecionar workspace ativo.
- Persistir workspace selecionado em localStorage.

### Onboarding / Treinamento Do Agente

Arquivo:

- `components/onboarding/onboarding-form.tsx`

Coleta:

- Nome da empresa/workspace.
- Explicação do negócio.
- Público-alvo/ICP.
- Proposta de valor.
- Objeções comuns.
- Objetivo da campanha.
- Tom de voz.

Comportamento:

- Se não existir workspace, cria `workspaces` + `workspace_members` + `agents`.
- Se já existir workspace, atualiza workspace/agente para evitar duplicidade.
- Após salvar, envia para `/leads/import`.

### Dashboard

Arquivo:

- `components/dashboard/product-dashboard.tsx`
- `components/dashboard/test-email-panel.tsx`

Mostra:

- Leads importados.
- Campanhas.
- Emails de cadência.
- Google conectado.
- Progresso do setup.
- Painel `Enviar e-mail de teste`.

### Envio De Teste Gmail

Arquivos:

- `components/dashboard/test-email-panel.tsx`
- `app/api/email/send-test/route.ts`
- `lib/email/gmail.ts`
- `lib/supabase-admin.ts`

Funcionalidades:

- Envio manual de teste pelo dashboard.
- Usa token Google conectado em `google_connections`.
- Roda apenas server-side.
- Verifica sessão do usuário pelo Bearer token Supabase.
- Verifica membership do workspace com service role.
- Renova access token com refresh token se estiver expirado.
- Envia e-mail via Gmail API `users/me/messages/send`.
- Grava `activity_logs` com `gmail_message_id`, `gmail_thread_id`, destinatário, assunto e remetente.

Requisito:

- `SUPABASE_SERVICE_ROLE_KEY` precisa estar configurada no ambiente local/server. Sem ela, a rota responde com erro orientando configurar a chave.

Limites atuais:

- Ainda não cria `email_threads`/`email_messages` para teste manual.
- Ainda não é engine automática.
- Ainda não lê respostas.

### Teste De Template Com Variáveis

Arquivos:

- `components/campaigns/template-test-panel.tsx`
- `app/api/email/send-template-test/route.ts`
- `lib/template.ts`
- `lib/email/gmail.ts`

Funcionalidades:

- Painel na rota `/campaigns/[id]/review`.
- Permite escolher um lead e um email da cadência.
- Mostra as variáveis disponíveis no estilo `{{first_name}}`, `{{company}}`, `{{title}}`, `{{objective}}`, `{{notes}}` e campos extras vindos do CSV.
- Renderiza preview de assunto e corpo antes do envio.
- Botão `Enviar template real` dispara o e-mail pela conta Gmail conectada.
- A rota server-side:
  - verifica sessão Supabase pelo Bearer token;
  - valida membership no workspace;
  - busca conexão Google, campanha, lead e passo da cadência;
  - renova access token se necessário;
  - aplica `renderTemplate`;
  - envia via Gmail API;
  - cria/atualiza `email_threads` quando o Gmail retorna `threadId`;
  - grava `email_messages` outbound;
  - marca o lead como `contacted`;
  - registra `activity_logs` com variáveis usadas, assunto, remetente e IDs Gmail.

Variáveis padrão:

```txt
{{email}}
{{first_name}}
{{last_name}}
{{full_name}}
{{company}}
{{title}}
{{objective}}
{{notes}}
{{website}}
{{linkedin}}
```

Observação: o botão envia e-mail real. Para testes automatizados, não clicar sem confirmação explícita do usuário.

### Importação CSV

Arquivos:

- `components/leads/csv-importer.tsx`
- `lib/csv.ts`
- `app/api/templates/leads-csv/route.ts`

Funcionalidades:

- Modelo CSV visível na tela.
- Botão de copiar modelo.
- Download direto do modelo.
- Upload `.csv`.
- Preview das primeiras linhas.
- Validação básica de email.
- Upsert em `leads` com conflito `workspace_id,email`.
- Campos desconhecidos vão para `custom_fields`.

Modelo CSV:

```csv
email,first_name,last_name,company,title,website,linkedin,notes
ana@empresa.com,Ana,Silva,Empresa Exemplo,Diretora Comercial,https://empresa.com,https://linkedin.com/in/ana,Lead vindo de lista outbound
```

### Lista De Leads

Arquivo:

- `components/leads/leads-list.tsx`

Funcionalidades:

- Lista leads do workspace.
- Busca por email, nome, empresa ou cargo.
- Mostra status e data de criação.

### Campanhas

Arquivos:

- `components/campaigns/campaigns-list.tsx`
- `components/campaigns/campaign-builder.tsx`

Funcionalidades:

- Lista campanhas.
- Cria campanha `draft`.
- Define:
  - nome;
  - objetivo;
  - limite mensal;
  - limite diário;
  - timezone dos leads;
  - horario inicial de envio;
  - espacamento em minutos entre envios;
  - dias úteis no `sending_window`.
- Sugestão inicial por setor:
  - Serviços B2B;
  - SaaS/Software;
  - Agências.

### Cadência

Arquivo:

- `components/campaigns/cadence-editor.tsx`

Funcionalidades:

- Editor de passos da cadência.
- Adicionar/remover emails.
- Delay em dias.
- Assunto.
- Corpo.
- Sugestão de cadência por setor:
  - quantidade recomendada de emails;
  - delays;
  - assuntos;
  - corpos.
- Salva em `cadence_steps`.
- Email 1 deve usar `delay_days = 0`, que significa "pode sair no primeiro horario elegivel depois da aprovacao".
- Follow-ups usam `delay_days` relativo ao ultimo email enviado para o lead. Exemplo: Email 2 com delay 3 sai 3 dias depois do Email 1, se o lead nao respondeu.
- Editor tem formatacao simples para corpo:
  - negrito;
  - italico;
  - link;
  - lista;
  - codigo;
  - variaveis.
- O texto formatado fica salvo como markup leve e é convertido para HTML no envio Gmail.

Bug já corrigido:

```txt
null value in column "id" of relation "cadence_steps" violates not-null constraint
```

Causa: upsert enviava `id: undefined/null` para novos passos.  
Correção: novos passos usam `insert` sem `id`; passos existentes usam `update`.

### Revisão / Aprovação De Campanha

Arquivos:

- `components/campaigns/campaign-review.tsx`
- `app/api/campaigns/approve/route.ts`
- `app/(app)/campaigns/[id]/review/page.tsx`
- `components/campaigns/campaigns-list.tsx`
- `components/campaigns/cadence-editor.tsx`

Funcionalidades:

- Rota `/campaigns/[id]/review`.
- Link `Revisar` na lista de campanhas.
- Link `Revisar campanha` no editor de cadência.
- Checklist antes da aprovação:
  - agente treinado;
  - leads importados;
  - Google conectado;
  - cadência com pelo menos um passo;
  - limites diário/mensal válidos.
- Resumo de janela e volume.
- Botão `Aprovar campanha`.
- Aprovação chama rota server-side `/api/campaigns/approve`.
- A rota usa `SUPABASE_SERVICE_ROLE_KEY`, valida sessão/membership, valida leads, cadência e Google conectado, e só então muda `campaigns.status` de `draft` para `approved`.
- Salva `approved_at`.
- Registra `activity_logs` com contagens e limites.
- A UI só deve mostrar "Campanha aprovada" depois da rota confirmar a linha atualizada no Supabase.

Bug já corrigido:

```txt
Tela mostrava "Campanha aprovada", mas o banco continuava `draft`.
```

Causa: update client-side podia afetar zero linhas sem ser tratado como erro.  
Correção: aprovação passou para rota server-side com `.select(...).single()` e confirmação real.

### Engine De Disparo De Cadência — MVP

Arquivos:

- `lib/campaign-dispatch-engine.ts`
- `app/api/cron/email-engine/route.ts`
- `vercel.json`
- Workflow n8n: `Vendas+IA Email Engine Cron`

Estado atual:

- A engine de envio de cadência já existe no MVP.
- `/api/cron/email-engine` agora executa três blocos operacionais por conta Google conectada:
  - refresh do access token Google quando necessário;
  - sync Gmail + IA para respostas inbound;
  - envio de cadência aprovado via `processCampaignCadenceSends`.
- A campanha só dispara quando `campaigns.status` está `approved` ou `active`.
- Ao primeiro envio real, campanha `approved` vira `active`.
- Envio usa Gmail API pelo e-mail conectado do workspace.
- Template é renderizado com variáveis (`{{company}}`, `{{first_name}}`, etc.) e HTML seguro via `renderRichTextHtml`.
- Cada envio cria/atualiza:
  - `send_jobs`;
  - `email_threads`;
  - `email_messages`;
  - `leads.status`;
  - `activity_logs`.

Configuracao atual por campanha:

- `sending_window.mode = "single"`;
- `sending_window.timezone`, por exemplo `America/Denver`;
- `sending_window.time`, por exemplo `09:00`;
- `sending_window.spacing_minutes`, por exemplo `4`;
- `daily_send_limit`, por exemplo `35`.

Regra de ritmo:

- A engine manda no maximo 1 e-mail por campanha a cada execucao do cron externo.
- O scheduler deve chamar `/api/cron/email-engine` no mesmo intervalo configurado em `spacing_minutes` ou proximo disso.
- A engine calcula quota acumulada pelo horario local da campanha.
- A engine nao faz "catch-up" fora da janela. Exemplo: `09:00`, `35/dia`, `4 min` fica elegivel aproximadamente de `09:00` ate `11:20` no timezone da campanha; fora disso, o cron roda, mas nao envia cadencia.

Protecoes anti-duplicidade e anti-spam:

- Nao envia para lead `replied`, `interested`, `meeting_booked`, `opted_out` ou `paused`.
- Nao envia follow-up se houve inbound depois do ultimo outbound.
- Nao envia para e-mails em `opt_outs`.
- Nao envia a mesma etapa para o mesmo lead se ja existir `send_jobs` `queued`, `running` ou `sent` para aquele `lead_id + cadence_step_id`.
- Migration local adicionada: `supabase/migrations/20260515000000_send_jobs_dedupe.sql`, com unique index parcial para reforcar a trava no banco.
- Cada execucao envia no maximo 1 e-mail por campanha para evitar rajadas.

Scheduler MVP:

- Vercel Hobby nao aceita cron subdiario. Tentativa com `0 * * * *` falhou no deploy por limite do plano Hobby.
- `vercel.json` permanece com cron diario (`0 12 * * *`) para manter compatibilidade com Hobby.
- Para o MVP real, foi criado no n8n o workflow ativo `Vendas+IA Email Engine Cron`.
- Esse workflow chama `https://www.vendasmaisia.com/api/cron/email-engine` a cada 5 minutos com header `Authorization: Bearer CRON_SECRET`.
- Workflow foi publicado e carregado no n8n com `triggerCount = 1`.
- Quando fecharmos Vercel Pro, migrar essa rotina para Vercel Cron subdiario e remover/desativar o workflow n8n correspondente.

### Inbox / Conversas

Arquivos:

- `app/(app)/inbox/page.tsx`
- `components/inbox/email-inbox.tsx`
- `components/app/app-shell.tsx`
- `supabase/migrations/20260506020000_email_threads_ai_toggle.sql`
- `supabase/migrations/20260506030000_email_messages_gmail_unique.sql`
- `app/api/email/sync/route.ts`
- `lib/email/gmail.ts`

Funcionalidades:

- Rota `/inbox`.
- Link `Conversas` no app shell.
- Layout operacional em três áreas:
  - lista de clientes/leads prospectados com busca, filtros nativos e favorito;
  - thread central em formato de chat, com bolhas inbound/outbound para leitura rapida;
  - painel lateral do lead com e-mail, empresa, cargo, remetente conectado, status e dados do CSV.
- Lista threads de `email_threads` e mensagens de `email_messages`.
- Agrupa múltiplas threads do Gmail pelo mesmo `lead_id`, para o usuário enxergar uma conversa única por lead.
- Mostra nome, empresa, último contato, status do lead/thread e dados do CSV.
- Mostra o conteúdo enviado pelo teste de template.
- Remove histórico citado de respostas recebidas (`Em ... escreveu`, linhas `>`, mensagem original) para deixar o painel legível.
- Filtros nativos atuais: todas, favoritos, responderam e sem resposta. Tags customizadas do usuário entram em uma etapa futura com persistência própria.
- Favoritos ficam persistidos localmente por workspace no MVP; em produção devem virar coluna/tabela no Supabase.
- Adiciona controle `email_threads.ai_enabled`.
- Botão lateral alterna IA ativa/pausada por thread e registra `activity_logs`.
- Botão `Sync + IA` chama `/api/email/sync` para sincronizar respostas das threads conhecidas no Gmail e, quando houver inbound novo, acionar a primeira engine de resposta automatica.
- A sincronização:
  - lê apenas threads que já têm `gmail_thread_id`;
  - se não encontrar respostas no mesmo `threadId`, busca mensagens recentes vindas do e-mail do lead com `from:{lead.email} newer_than:30d`;
  - cria uma nova `email_threads` vinculada ao mesmo lead quando o Gmail agrupou a resposta em outro thread;
  - busca mensagens via Gmail API `users/me/threads/{threadId}`;
  - grava/atualiza `email_messages` por `workspace_id,gmail_message_id`;
  - identifica inbound/outbound comparando `From` com o e-mail Google conectado;
  - atualiza `email_threads.last_message_at`;
  - muda lead para `replied` quando encontra mensagem inbound;
  - registra `activity_logs` com contadores e erros.
- A engine de resposta automatica:
  - usa o agente treinado (`agents.business_context`, `common_objections`, `campaign_goal`);
  - considera dados do lead e historico da thread;
  - chama Gemini via `GEMINI_API_KEY`;
  - envia resposta pelo Gmail conectado quando `email_threads.ai_enabled=true`;
  - evita responder quando ja existe outbound depois da ultima resposta inbound;
  - registra decisao em `email_ai_actions` quando a migration estiver aplicada;
  - registra envio em `activity_logs`;
  - marca `negative` quando o lead diz que não tem interesse;
  - marca `opted_out` apenas quando o lead pede descadastro, remoção, parada ou unsubscribe.
  - cria evento no Google Calendar quando a IA identificar data/horario explicitos e retornar `meeting_start_iso`/`meeting_end_iso`.
- Cron de operacao:
  - rota `/api/cron/email-engine`;
  - configurada em `vercel.json` para rodar uma vez por dia no plano Vercel Hobby atual;
  - no MVP real, n8n chama essa rota a cada 5 minutos pelo workflow `Vendas+IA Email Engine Cron`;
  - quando fecharmos Vercel Pro, substituir o n8n por Vercel Cron subdiario;
  - exige `Authorization: Bearer ${CRON_SECRET}`;
  - sincroniza Gmail e processa IA para contas Google conectadas;
  - respeita atraso minimo da resposta inbound (`AI_REPLY_MIN_AGE_MINUTES`);
  - respeita limite diario por workspace (`AI_DAILY_EMAIL_LIMIT_PER_WORKSPACE`);
  - processa poucos replies por workspace por rodada para evitar rajada.

Limites atuais:

- Sync Gmail + IA agora existe tambem por cron. Em ambiente local, o botão continua sendo o caminho mais facil de teste.
- Ainda não envia respostas manuais pela Inbox.
- Em Vercel Hobby, cron subdiario falha no deploy. O deploy de 2026-05-07 foi publicado com cron diario (`0 12 * * *`) para manter produção ativa.
- Calendar automatico existe com guarda: cria evento apenas quando a IA extrai horario claro. Se o lead demonstrar interesse sem horario, a IA conduz para combinar agenda.

### Google Connection

Arquivos:

- `components/settings/google-connection-panel.tsx`
- `lib/google/oauth.ts`
- `lib/supabase-server.ts`
- `app/api/auth/google/callback/route.ts`
- `supabase/migrations/20260506000000_google_oauth_connection_flow.sql`
- `supabase/migrations/20260506010000_google_connection_status_and_disconnect.sql`

Estado atual:

- Tela lista escopos e status por workspace.
- Botão gera `state` forte no browser autenticado.
- `state` é salvo em `google_oauth_states` com `workspace_id`, `user_id` e expiração.
- Google redireciona para `/api/auth/google/callback`.
- Callback troca `code` por tokens no backend.
- Callback busca o e-mail Google conectado.
- Callback chama a função Postgres `complete_google_oauth_connection`.
- A função valida `state`, expiração e uso único, salva/atualiza `google_connections` e grava `activity_logs`.
- Refresh token não passa de volta para o browser.
- A tela usa RPC `get_google_connection_status`, que retorna apenas colunas não sensíveis.
- A policy ampla antiga de `google_connections` foi removida para impedir leitura direta de tokens pelo browser.
- A tela permite:
  - desconectar a conta atual;
  - conectar outra conta Google.
- A desconexão usa RPC `disconnect_google_connection`, limpa tokens, marca status `revoked` e registra log.

Pendências:

- Configurar `NEXT_PUBLIC_GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`.
- No Google Cloud, autorizar redirect URI local:
  - `http://localhost:3000/api/auth/google/callback`
- No deploy, autorizar redirect URI de produção:
  - `https://app.vendasmaisia.com/api/auth/google/callback`
- Antes de produção, ativar criptografia real para os campos `access_token_ciphertext` e `refresh_token_ciphertext`. Hoje o MVP bloqueia leitura direta pelo browser, mas os nomes `ciphertext` ainda representam a intenção de segurança final.
- Antes de produção, trocar a desconexão local por revogação real no endpoint OAuth do Google, quando possível.

---

## Design / UX

Direção visual:

- Seguir o app atual `vendas-ai-app`, sem inventar moda.
- Topbar azul/slate.
- Acento dourado.
- Cards brancos em fundo cinza claro.
- Interface de trabalho, não landing page.
- Texto e campos precisam ter alto contraste.

Correção já aplicada:

- Inputs, textareas e selects agora têm texto escuro globalmente em `app/globals.css`.
- Placeholders ficaram mais legíveis.

---

## Como Rodar Localmente

```bash
npm run dev
```

URL:

```txt
http://localhost:3000
```

A raiz `/` é a landing pública. Para ver o app:

```txt
http://localhost:3000/login
http://localhost:3000/dashboard
http://localhost:3000/onboarding
http://localhost:3000/leads/import
http://localhost:3000/campaigns
```

Validação usada:

```bash
npm run lint
npm run build
```

Estado atual:

- `npm run lint`: passa com warnings antigos da landing.
- `npm run build`: passa.

Warnings conhecidos:

- Imports não usados e `<img>` na landing antiga.
- Não foram corrigidos porque a landing deve ficar intacta salvo pedido explícito.

---

## Próximas Fases Recomendadas

### Próxima Mini-Fase: Piloto Interno Real

Objetivo: usar o produto para prospectar leads reais de um produto próprio antes da venda global.

Tarefas:

- Aplicar no Supabase as migrations pendentes `email_ai_actions` e `lead_negative_status`.
- Importar lista pequena real.
- Rodar 10-20 leads no primeiro teste.
- Subir gradualmente para 30-50 novos leads/dia por conta.
- Revisar as primeiras respostas da IA manualmente no inbox.
- Ajustar treinamento do agente, objeções, tom e cadência com base nas respostas reais.
- Monitorar `send_jobs`, `email_messages` e `activity_logs` nas primeiras 24-48h de campanha.
- Confirmar se o workflow n8n `Vendas+IA Email Engine Cron` executou dentro da janela do timezone da campanha.
- Confirmar se a primeira campanha aprovada (`Outbound SaaS - Vetiranarios`) enviou sem duplicidade e sem rajada.

### Depois: Segurança/Readiness Antes De Venda

Tarefas:

- Rotacionar chaves compartilhadas durante desenvolvimento.
- Criptografar tokens OAuth de Gmail/Outlook de verdade.
- Revisar RLS apenas das tabelas do app novo.
- Finalizar envs de Production/Preview/Development na Vercel.
- Validar redirects OAuth em `app.vendasmaisia.com`.
- Migrar scheduler do n8n para Vercel Cron subdiario quando o projeto estiver no Vercel Pro.

### Depois: Outlook/Microsoft 365

Tarefas:

- Criar conexão provider-based para Gmail e Microsoft.
- Implementar Microsoft OAuth com `offline_access`, `openid`, `email`, `profile`, `Mail.Send`, `Mail.Read` ou `Mail.ReadBasic`, `Calendars.ReadWrite`.
- Criar adaptadores comuns `sendMessage`, `syncThreads`, `createCalendarEvent`.
- Alimentar as mesmas tabelas internas `email_threads`, `email_messages`, `leads` e `activity_logs`.

### Depois: Stripe Billing

Tarefas:

- Modelo mensal e anual por pacote de volume.
- Stripe Billing + Checkout Sessions em `subscription`.
- Customer Portal para troca/cancelamento.
- Webhook para ativar/desativar limites por workspace.

### Depois: Fila Planejada / Observabilidade De Disparo

Objetivo: dar mais visibilidade antes e depois da execucao automatica.

Tarefas:

- Criar tela `Fila de envios`.
- Mostrar próximos leads elegíveis.
- Mostrar etapa da cadência por lead.
- Mostrar motivo de bloqueio: opt-out, respondeu, pausado, fora da janela, limite diário.
- Mostrar `send_jobs` recentes com status `sent`, `failed`, `blocked`.
- Expor contadores por campanha: enviados hoje, restantes hoje, janela ativa/inativa.
- Permitir pausa operacional sem editar a cadência.

### Depois: Robustez OAuth/Segurança

Tarefas:

- Adicionar criptografia AES-GCM ou Vault para tokens Google.
- Criar ação de desconectar/revogar Google.
- Melhorar auth para SSR/cookies quando o app sair do MVP.
- Validar escopos concedidos e alertar se Gmail ou Calendar ficarem faltando.

### Depois: Hardening Da Engine De Envio

Tarefas:

- Aplicar migration `20260515000000_send_jobs_dedupe.sql` em produção se ainda não estiver aplicada.
- Criar retries controlados para `send_jobs.failed`.
- Criar alertas quando Gmail API retornar erro de quota, auth ou compliance.
- Criar botão interno de `Executar agora` apenas para admins, mantendo a trava de 1 e-mail por campanha por execução.
- Adicionar métricas de deliverability: enviados, respostas, bounce manual/importado, opt-out.

### Depois: Sync E Inbox

Tarefas:

- Polling Gmail inicial ou push.
- Criar/atualizar `email_threads`.
- Criar `email_messages`.
- Pausar lead quando responder.
- Classificar resposta com IA.
- Preparar agendamento Google Calendar.

---

## Cuidados Importantes Para Próximos Agentes

- Não mexer em tabelas legadas `vendas_*`, `faleiro_*`, `vetdoc_*`, etc. Elas pertencem a outro produto/legado.
- Não aplicar RLS automaticamente em tabelas antigas. O MCP avisou que várias têm RLS desligado, mas isso está fora do escopo atual.
- Não usar secret key no browser.
- Não recriar o padrão antigo de tabela por cliente.
- Não implementar engine de disparo sem opt-out, limites e logs.
- Não mandar e-mail automaticamente antes de haver aprovação explícita do usuário.
- Não remover a trava de 1 e-mail por campanha por execução sem substituir por fila/rate limiter mais robusto.
- Não depender apenas do cron diario da Vercel Hobby para prospeccao real; o MVP usa n8n como scheduler externo ate migrar para Vercel Pro.
- Não transformar o app em landing; a UI do app deve ser operacional.

---

## Changelog

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-05-05 | Fase 1: auth inicial, app shell, onboarding, dashboard vazio, Google settings, migration multi-tenant com RLS aplicada via Supabase MCP | Codex |
| 2026-05-05 | Fase 2: onboarding workspace-aware, importação CSV, modelo CSV, lista de leads, campanhas draft, editor de cadência, sugestões por setor, correção de contraste dos campos | Codex |
| 2026-05-05 | Corrigida env local: `NEXT_PUBLIC_SUPABASE_ANON_KEY` deixou de usar `sb_secret_...` e passou a usar chave pública/publishable | Codex |
| 2026-05-06 | Mini-fase Google OAuth: criada tabela `google_oauth_states`, função `complete_google_oauth_connection`, callback `/api/auth/google/callback` e UI de conexão por workspace | Codex |
| 2026-05-06 | Segurança/UX Google: removida leitura direta de `google_connections`, criada RPC de status sem tokens e botão de desconectar/conectar outra conta | Codex |
| 2026-05-06 | Aprovação de campanha: rota `/campaigns/[id]/review`, checklist de requisitos, status `approved`, `approved_at` e log de aprovação | Codex |
| 2026-05-06 | Envio de teste: painel no dashboard e rota `/api/email/send-test` para validar Gmail API server-side antes da engine automática | Codex |
| 2026-05-06 | Teste de template real: painel no review da campanha com variáveis `{{...}}`, preview renderizado, envio Gmail, criação de thread/message e log | Codex |
| 2026-05-06 | Inbox inicial: rota `/inbox`, layout de conversas em três colunas, leitura de threads/messages e toggle `ai_enabled` por thread | Codex |
| 2026-05-06 | Sync Gmail manual: rota `/api/email/sync`, botão `Sync` na Inbox, leitura de threads conhecidas, upsert de mensagens e status `replied` para respostas inbound | Codex |
| 2026-05-06 | Inbox refinado para padrão Gmail/CRM: lista de leads acionados, thread central por lead, limpeza de histórico citado e painel lateral sem status duplicado | Codex |
| 2026-05-07 | Engine operacional: cron `/api/cron/email-engine`, atraso mínimo para resposta IA, limite diário por workspace, Sync+IA reutilizável e dashboard com overview/funil | Codex |
| 2026-05-07 | Piloto interno: adicionado status `negative`, dashboard sem card Opt-out/IA ativa, negativas agregam recusas e opt-out, IA distingue negativa de descadastro | Codex |
| 2026-05-15 | MVP de disparo de cadência: engine `processCampaignCadenceSends`, envio via Gmail, `send_jobs`, travas anti-duplicidade, limite de 1 e-mail por campanha por execução, timezone/horário único/espaçamento por campanha | Codex |
| 2026-05-15 | Scheduler MVP: workflow n8n `Vendas+IA Email Engine Cron` ativo a cada 5 minutos chamando `/api/cron/email-engine` com `CRON_SECRET`; Vercel Cron subdiário fica para quando o projeto migrar para Vercel Pro | Codex |
| 2026-05-15 | Aprovação de campanha corrigida: criada rota server-side `/api/campaigns/approve` para confirmar persistência real no Supabase antes de mostrar campanha aprovada na UI | Codex |
| 2026-05-29 | Épico 1.6 — Onboarding OAuth externo end-to-end: wizard reordenado (Agente→Gmail→Leads→Campanha), novo usuário inicia no passo de agente sem spinner infinito, callback checa workspace e roteia para /setup ou /dashboard, Google OAuth callback usa redirect_to do state row, mensagens de erro humanas para access_denied/invalid_grant, persistência de onboarding_step na tabela workspaces (migration aplicada), login com Google na tela de login rota corretamente via /callback | Claude |
| 2026-05-29 | Fix ProductDashboard: `<>` em `.map()` substituído por `<React.Fragment key={row.filter}>` eliminando erro de React key prop; cache `.next` limpo para compilar corretamente | Claude |
| 2026-05-29 | Enrichment de leads com IA (Apify caixa-preta): migration `enrichment_jobs`, `lib/enrichment/apify.ts` (chooseActor via Gemini + startApifyRun + getApifyRunStatus + fetchAndMapResults), rota `/api/leads/enrich` (POST start/import + GET poll), `EnrichmentPanel` com form ICP pré-preenchido do agente, preview de leads com status de e-mail válido/inferido, quota mensal por workspace (1000 leads), allowlist de 4 actors Apify, dedupe contra leads existentes, `activity_logs` em todos os fluxos. Aba "Buscar com IA" adicionada ao lado de CSV em `/leads/import`. "Apify" nunca exposto na UI. | Claude |
| 2026-06-01 | Épico ADK reply-agent (Python no Cloud Run): microserviço `services/adk-agent/` com Google ADK 2.1 + Gemini, agente multi-step com tools (`classify_intent` → `create_calendar_event` → `submit_decision`) que devolve `EmailAgentDecision` 1:1 com o TS; system instruction portada de `email-agent.ts`. Endpoint FastAPI `/v1/decide` autenticado por header `X-ADK-Secret` (fail-closed) + `/health`. Calendar: agente só extrai/valida a janela ISO; o TS continua criando o evento com o token OAuth do usuário (nenhum token migra pro Python). Integração TS via `lib/ai/adk-client.ts` atrás da flag `USE_ADK_REPLY` (default false), com fallback automático pro cérebro TS em falha/timeout. Traces estruturados por step para Cloud Logging. Dockerfile + `deploy.sh` (Cloud Run via Cloud Build) prontos; deploy real pendente (gcloud/Docker não instalados nesta máquina). | Claude |
| 2026-06-01 | Integração MCP (Vendas+IA publicado como MCP server): migration `workspace_api_tokens` (guarda só hash sha256, prefix, scopes read/write/send, rate limit, `revoked_at`, RLS de membros). Rota Streamable HTTP stateless em `/api/mcp` com SDK oficial `@modelcontextprotocol/sdk`, auth por token de workspace (Bearer), 60 req/min por token. 9 tools whitelist: read (`list_campaigns`, `get_campaign`, `get_funnel_stats`, `list_recent_replies`, `list_leads`) e write (`create_campaign_draft` cria rascunho sem disparar, `enrich_leads` reusa o fluxo Apify caixa-preta com quota/cap, `pause_campaign`/`resume_campaign`); nenhuma tool envia e-mail. Cada chamada valida scope e audita em `activity_logs` com prefixo `mcp:`. UI `/settings/integrations` (gera token em texto puro uma única vez, lista/revoga, mostra comando `claude mcp add`); endpoints `/api/mcp-tokens` com auth de sessão. Validado localhost end-to-end (initialize/tools-list/funil com números reais/rascunho criado/recusa de scope/auditoria). | Claude |
| 2026-06-01 | Infra Google Cloud: ADK deployado no Cloud Run (serviço `adk-reply-agent`, region us-central1, build via Cloud Build sem Docker local) — `/health` e `/v1/decide` (auth por `X-ADK-Secret`, fail-closed) validados em produção e trace multi-step (`classify_intent`→`create_calendar_event`→`submit_decision`) no Cloud Logging. App de produção (Vercel) ligado ao ADK via flag `USE_ADK_REPLY=true` (reversível em 1 passo + redeploy; fallback automático pro motor TS comprovado). Cron de 5 min migrado do n8n pro Cloud Scheduler (job `vendasia-email-engine`, */5, fuso America/Sao_Paulo, `Authorization: Bearer CRON_SECRET`); n8n mantido como backup pausável. Exceção de org policy `iam.allowedPolicyMemberDomains` escopada só ao projeto p/ permitir ingress público (proteção real no shared secret). | Claude |
| 2026-06-03 | Evals do cérebro de classificação (`lib/ai/email-agent.ts`): runner próprio em `evals/` (sem deps novas, Node 24 TS nativo) sobre ~200 conversas reais do Vendas+IA no WhatsApp + gold humano de 30 revisado pelo dono (concordância 93,3%). Gabarito `status_funil`→`intent` em `evals/label-map.ts`; dataset PII fica em `evals/datasets/` (gitignored). System instruction versionada V1→V2 (selecionável por `EMAIL_AGENT_PROMPT_VERSION`, default v2, reversível). Resultados (Gemini real): reply classification accuracy 29,5%→62,0% (macro-F1 23,8%→53,9%); meeting extraction F1 40,0%→77,8%. Corrigidos 2 bugs do cérebro que zeravam o piloto: `gemini-2.5-flash` gastava o orçamento com "thinking" (JSON vazio) e `maxOutputTokens` truncava o JSON → fix `thinkingBudget:0` + `maxOutputTokens:4096`. | Claude |
