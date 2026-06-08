# ADK Reply Agent (Vendas+IA)

Python microservice built on the **Google Agent Development Kit (ADK)** + Gemini.
It is the multi-agent version of the single-shot brain in `lib/ai/email-agent.ts`.
Given an agent profile, lead data, and the thread history, it returns the exact
same `EmailAgentDecision` JSON the TypeScript engine already consumes — so it is a
drop-in swap behind a feature flag (`USE_ADK_REPLY`).

## What it does — a 3-stage multi-agent pipeline

A root `SequentialAgent` (`reply_pipeline`, see `app/agent.py`) runs three
specialist sub-agents in order. Each one writes its **structured output** to
session state (`output_schema` + `output_key`) and hands it to the next:

1. **`conversation_classifier`** → `Classification` — reads the full thread and
   classifies only the lead's latest reply (intent, confidence, reasoning).
2. **`meeting_extractor`** → `MeetingWindow` — decides whether a concrete date AND
   time were actually agreed; if so it proposes the window in ISO 8601 with a
   timezone offset, defaulting to a 30-minute duration. Otherwise `has_meeting=false`.
3. **`reply_drafter`** → `EmailAgentDecision` — writes the final decision and the
   reply in the lead's own language, using the two upstream outputs as context.

Each sub-agent emits one structured JSON line via an `after_agent_callback`, and
the runner emits a final `pipeline_run` line — so the whole orchestration is
queryable as a trace in **Cloud Logging** and feeds the evals harness.

### The runner reconciles, the drafter doesn't get the last word

`app/runner.py` reads the three outputs and **reconciles the meeting** before
returning: it only books (`lead_status="meeting_booked"`) when `meeting_extractor`
set `has_meeting=true` *and* both ISO timestamps are valid. If `reply_drafter`
claims a booking the extractor never confirmed, the runner downgrades it to
`interested`. This keeps a hallucinated booking from ever creating a real invite.

### Calendar: why the event is created on the TS side

No sub-agent creates the real Google Calendar event. The user's OAuth token lives
in the TypeScript/Supabase app and is intentionally never moved into Python.
`meeting_extractor` only *proposes* the validated `meeting_start_iso` /
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

The service runs on **Cloud Run** (`adk-reply-agent`, region `us-central1`),
deployed via Cloud Build — no local Docker needed:

```bash
GCP_PROJECT=my-project GEMINI_API_KEY=... ADK_SHARED_SECRET=... ./deploy.sh
```

Then point the TS app at it: set `ADK_REPLY_URL=<service-url>/v1/decide`,
`ADK_SHARED_SECRET=<same secret>`, and `USE_ADK_REPLY=true` (per workspace/env).
Because the TS engine falls back automatically on any ADK error/timeout, a new
revision can be rolled out with `--no-traffic --tag` and validated on its tag URL
before taking 100% of traffic.

## Observability — read the multi-agent trace

Each sub-agent logs its structured output, so you can watch the orchestration
end-to-end. One line per sub-agent:

```bash
gcloud logging read \
  'resource.labels.service_name=adk-reply-agent AND jsonPayload.step="subagent"' \
  --project my-project --limit 9 --freshness 30m \
  --format="value(timestamp,jsonPayload.agent,jsonPayload.output)"
```

The final reconciled summary (the ordered list of sub-agents that ran for a reply):

```bash
gcloud logging read \
  'resource.labels.service_name=adk-reply-agent AND jsonPayload.step="pipeline_run"' \
  --project my-project --limit 10
```
