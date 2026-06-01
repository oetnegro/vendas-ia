# Landing Page Brief — Vendas+IA

> Documento de contexto permanente para o agente. Atualizar sempre que uma mudança relevante for aplicada.

---

## Produto

**Nome**: Vendas+IA  
**URL**: https://www.vendasmaisia.com  
**Categoria**: SaaS B2B — IA de Prospecção e Pré-Vendas  
**Preço inicial**: R$ 599/mês (CRM incluído)  
**Setup**: R$ 999 (único)  
**Ativação**: 7 dias  
**Fidelidade**: Sem fidelidade  

### O que faz
Substitui SDRs e BDRs tradicionais por uma IA que prospecta, qualifica leads e agenda reuniões 24/7 via WhatsApp, usando a API oficial do Meta. Inclui CRM próprio e dashboard em tempo real.

### Diferenciais principais
- API oficial do WhatsApp Business (Meta Business Partner)
- CRM incluído no plano (não é cobrado à parte)
- Ativação em 7 dias
- DDDs de todos os estados do Brasil
- Integração nativa: HubSpot, Salesforce, Pipedrive, RD Station
- Participante do Google for Startups

---

## Público-alvo

- **Segmento**: Empresas B2B com time comercial (1–10+ SDRs/BDRs)
- **Perfis**: Agências, empresas B2B, empresas de serviços
- **Dor principal**: Custo elevado e baixa produtividade de SDRs humanos
- **Motivador de compra**: Economia de até 80% no custo de pré-vendas com mais resultado

---

## Keywords SEO prioritárias

| Keyword | Volume Est. | Dificuldade |
|---------|-------------|-------------|
| IA para prospecção de vendas | 1.200/mês | Média |
| SDR com inteligência artificial | 800/mês | Média |
| automação de pré-vendas WhatsApp | 600/mês | Baixa |
| CRM com IA para vendas B2B | 900/mês | Média |
| IA de prospecção B2B | — | Baixa |
| chatbot de vendas WhatsApp | — | Baixa |
| substituir SDR por IA | — | Baixa |

---

## Estrutura da Landing Page

| Seção | ID / Âncora | Descrição |
|-------|-------------|-----------|
| Hero | `#hero` | H1 rotativo + subtítulo + CTAs + card de demo |
| Social proof rápido | — | Logo Meta Partner + badges |
| Features mini-cards | — | Prospecção WhatsApp, Dashboard, Agendamento |
| Stats bar | — | Números de impacto (leads/mês, reuniões, economia) |
| Demo interativa | `#features` | Painéis: Chat IA, CRM, Agendamento, Dashboard |
| Cases de uso | — | Agências, B2B, Serviços |
| Calculadora | `#calculadora` | Slider SDRs × custo CRM → economia com Vendas+IA |
| Planos | `#planos` | 4 planos de preço (Starter, Growth, Scale, Enterprise) |
| FAQ | `#faq` | 8 perguntas com respostas otimizadas para SEO |
| Reputação/Parceiros | — | Meta Business Partner, Google for Startups |
| Contato / CTA final | `#contato` | Formulário de lead (nome, email, telefone, empresa, equipe, desafio) |
| Footer | — | Links, copyright |

**Páginas adicionais**: `/sobre`, `/privacidade`

---

## Tom de Voz e Copy

- **Tom**: Direto, confiante, técnico mas acessível — fala com gestores e donos de empresa
- **Evitar**: Jargão excessivo, linguagem passiva, promessas vagas
- **Focar em**: Resultado concreto (%), economia em R$, tempo de ativação
- **Marca**: Sempre escrever **"Vendas+IA"** (com o sinal +, nunca "VendasIA" ou "Vendas IA")
- **CTA padrão**: Direcionar para `#contato` ou `#planos`

---

## Arquivos Principais

| Arquivo | Papel |
|---------|-------|
| `app/layout.tsx` | Metadata global, Open Graph, Twitter Cards, JSON-LD schemas |
| `app/page.tsx` | Landing page completa (~1841 linhas, client component) |
| `app/sobre/page.tsx` | Página sobre (client) |
| `app/sobre/layout.tsx` | Metadata da página /sobre |
| `app/privacidade/page.tsx` | Política de privacidade + metadata |
| `app/sitemap.ts` | Sitemap dinâmico (/, /sobre, /privacidade) |
| `public/robots.txt` | Diretivas para crawlers |
| `app/api/contato/route.ts` | POST leads → Supabase + email via Resend |
| `lib/supabase.ts` | Cliente Supabase |

---

## Schemas JSON-LD Implementados

- **Organization**: nome, url, logo, contato, LinkedIn
- **FAQPage**: 8 Q&A da seção de dúvidas
- **SoftwareApplication**: nome, categoria, preço (R$599/mês), plataforma

---

## Changelog

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-05-11 | Isolado FAQPage/SoftwareApplication schema somente na landing e aplicado `noindex` nas rotas autenticadas/auth para evitar indexação/canonical indevida do app | Codex |
| 2026-05-11 | Ajustes SEO técnicos: H1 canônico com keyword principal, OG image 1200x630 via Metadata API, canonical/sitemap raiz com barra final e schemas enriquecidos sem avaliações fictícias | Codex |
| 2026-05-11 | Adicionadas perguntas SEO sobre "O que é a VendasMaisIA?" e confiabilidade, com FAQPage JSON-LD sincronizado | Codex |
| 2026-04-28 | Implementação completa SEO técnico: meta title/desc otimizados, Open Graph, Twitter Cards, canonical, robots.txt, sitemap.xml dinâmico, JSON-LD (Organization + FAQPage + SoftwareApplication), metadata por página (/sobre, /privacidade) | Agente (plano SEO especialista) |
| 2026-04-28 | Melhorias de copy: FAQ reescrito com menções da marca Vendas+IA e keywords SEO; hero subtitle com marca; features mini-cards com marca; descrição calculadora; alt texts descritivos nas imagens | Agente (plano SEO especialista) |
