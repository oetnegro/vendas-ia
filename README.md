# Vendas+IA Landing + Email Prospecting App

Este repo contém duas superfícies:

- Landing pública em `/`, documentada em `landing-page-brief.md`.
- App autenticado de prospecção por e-mail em `app/(app)`, documentado em `product-brief.md`.

Leia `product-brief.md` antes de mexer no app. Ele é a fonte de contexto operacional do MVP.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Supabase Auth/Postgres
- Gmail + Google Calendar OAuth
- Gemini para respostas automáticas
- Vercel para deploy
- n8n como scheduler externo temporário do MVP

## Desenvolvimento

```bash
npm run dev
```

App local:

```txt
http://localhost:3000/login
http://localhost:3000/dashboard
http://localhost:3000/campaigns
```

Validação:

```bash
npm run build
```

## Scheduler Do MVP

O plano Vercel Hobby só permite cron diário. Para o MVP de prospecção real, o n8n roda o workflow:

```txt
Vendas+IA Email Engine Cron
```

Ele chama a cada 5 minutos:

```txt
GET https://www.vendasmaisia.com/api/cron/email-engine
Authorization: Bearer CRON_SECRET
```

Quando o projeto migrar para Vercel Pro, mover esse agendamento para Vercel Cron subdiário e desativar o workflow n8n.

## Segurança

- Nunca usar `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY` ou `CRON_SECRET` no browser.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` deve ser publishable/anon pública, nunca `sb_secret`.
- Tokens Google ficam server-side e devem receber criptografia real antes de venda pública.
