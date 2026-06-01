# ADK Reply Agent (Vendas+IA)

Python microservice built on the **Google Agent Development Kit (ADK)** + Gemini.
It is the multi-step, tool-using version of the single-shot brain in
`lib/ai/email-agent.ts`. Given an agent profile, lead data, and the thread history,
it returns the exact same `EmailAgentDecision` JSON the TypeScript engine already
consumes — so it is a drop-in swap behind a feature flag.

## What it does

The agent runs declaratively with three tools:

1. `classify_intent` — commits the intent/confidence/reasoning for the lead's reply.
2. `create_calendar_event` — when (and only when) the lead confirms a concrete date
   and time, it validates and returns the meeting window in ISO 8601.
3. `submit_decision` — emits the final `EmailAgentDecision`.

Each step is logged as a structured JSON line, so the decision trace is queryable
in **Cloud Logging** and feeds the evals épico.

### Calendar: why the event is created on the TS side

The agent never creates the real Google Calendar event. The user's OAuth token
lives in the TypeScript/Supabase app and is intentionally never moved into Python.
`create_calendar_event` only returns the validated `meeting_start_iso` /
`meeting_end_iso`; the TS engine (`email-reply-engine.ts`) creates the invite with
the user's token, exactly as it does today. This keeps the token blast radius
unchanged and needs no callback endpoint.

## API

- `GET /health` — liveness + config probe.
- `POST /v1/decide` — body is `DecisionRequest` (`agent`, `lead`, `messages`),
  response is `EmailAgentDecision`. Requires header `X-ADK-Secret: <ADK_SHARED_SECRET>`.
  On internal failure it returns `502` so the caller can fall back.

## Environment

| Var | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | yes | Mapped to `GOOGLE_API_KEY` for ADK. |
| `ADK_SHARED_SECRET` | yes | Must match the header from the TS engine. Fail-closed. |
| `GEMINI_MODEL` | no | Default `gemini-2.5-flash`. |

## Run locally

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

# One-shot agent test (no server):
GEMINI_API_KEY=... python test_local.py

# HTTP server:
GEMINI_API_KEY=... ADK_SHARED_SECRET=dev-secret \
  uvicorn app.main:app --host 0.0.0.0 --port 8080
```

```bash
curl -s localhost:8080/v1/decide \
  -H 'content-type: application/json' \
  -H 'X-ADK-Secret: dev-secret' \
  -d @sample.json
```

## Deploy to Cloud Run

`gcloud`/Docker were not available on the authoring machine, so the service was
validated locally only. To deploy (builds via Cloud Build — no local Docker
needed):

```bash
GCP_PROJECT=my-project GEMINI_API_KEY=... ADK_SHARED_SECRET=... ./deploy.sh
```

Then point the TS app at it: set `ADK_REPLY_URL=<service-url>/v1/decide`,
`ADK_SHARED_SECRET=<same secret>`, and `USE_ADK_REPLY=true` (per workspace/env).

View traces:

```bash
gcloud logging read \
  'resource.type=cloud_run_revision AND jsonPayload.component=adk-reply-agent' \
  --project my-project --limit 50
```
