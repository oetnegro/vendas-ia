# Reviewing Vendas+IA — a 3-step path to see the agent work

> For the Google for Startups AI Agents Challenge judges. The goal of this page is
> to let you verify the product's core claims **end-to-end in about 5 minutes**,
> without cloning or building anything.

- 🌐 **Live app:** https://www.vendasmaisia.com
- 🎥 **Demo video:** https://youtu.be/aKX7wyC7MK4

There are two front doors into the same agent brain: the **web app** and a
**published MCP server**. The steps below walk both.

---

## Step 1 — Generate a lead list from one sentence (enrichment agent)

1. Sign up at https://www.vendasmaisia.com and create a workspace.
2. Describe your ideal customer in plain language — e.g. *"veterinary clinics in
   São Paulo"* — and start the enrichment run.
3. In ~2 minutes you get a warm, validated lead list (name, company, role, email).

**What you just exercised:** the enrichment agent turns a natural-language ICP into
a structured, deduplicated, validated list via a third-party B2B data-enrichment API
(server-side only).

## Step 2 — Drive the funnel from your AI coding tool (published MCP server)

This is the part most submissions don't have: a **non-technical founder runs real
sales ops from inside Claude / Cursor / Codex.**

1. In the app, go to **Settings → Integrations** and generate an **MCP token**
   (scoped, revocable, rate-limited; every call is audited).
2. Add the Vendas+IA MCP server to your AI tool with that token.
3. Ask, in natural language:
   - *"How's my funnel this week?"* → calls `get_funnel_stats`
   - *"List my most recent replies"* → `list_recent_replies`
   - *"Draft a campaign for SaaS CTOs"* → `create_campaign_draft`
   - *"Pause campaign X"* → `pause_campaign`

**What you just exercised:** the same intents the web app sends, now coming from an
AI agent through MCP. No tool sends email directly — sends always go through the
platform's human-approval flow.

## Step 3 — Watch the multi-agent reply brain (optional, deepest signal)

When a lead replies, an **ADK `SequentialAgent` of three specialists** reads the
thread, classifies intent, extracts any agreed meeting window, and drafts the reply
in the lead's language. If a concrete date+time is confirmed, the **TypeScript**
engine creates the Google Calendar invite (the OAuth token never enters Python).

- The pipeline and its three sub-agents are documented in
  [`services/adk-agent/README.md`](services/adk-agent/README.md), including the exact
  `gcloud logging` query to read the per-sub-agent trace.
- A real inbound produces one structured log line per sub-agent
  (`conversation_classifier` → `meeting_extractor` → `reply_drafter`) plus a final
  reconciled `pipeline_run` line.

---

## How to read the code (fastest tour)

| You want to see… | Look at |
|---|---|
| The multi-agent orchestration | [`services/adk-agent/app/agent.py`](services/adk-agent/app/agent.py) — `SequentialAgent` + 3 `LlmAgent`s with `output_schema`/`output_key` |
| Why a hallucinated booking can't create an invite | [`services/adk-agent/app/runner.py`](services/adk-agent/app/runner.py) — the reconciliation step |
| The feature-flag swap (ADK vs TS fallback) | [`lib/ai/adk-client.ts`](lib/ai/adk-client.ts) — gated on `USE_ADK_REPLY`, auto-falls back on any error/timeout |
| The published MCP server (tools the judge can call) | the `vendas-ia` MCP server — read-only stats + write actions, all audited |
| Eval methodology + honesty notes | [`evals/report.md`](evals/report.md) |

## Honesty notes

- The reply agent is **additive and behind a feature flag** (`USE_ADK_REPLY`); the
  deterministic TypeScript engine is the always-on fallback, so the live pilot never
  breaks even if the Python service is down.
- Evals were measured against a human gold standard; methodology, sample sizes, and
  caveats (including the WhatsApp-vs-email domain gap) are written up honestly in
  [`evals/report.md`](evals/report.md).
- Secrets are server-side only and the repo has been scanned clean; see the
  **Security** section of the [main README](README.md).
