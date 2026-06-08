"""The ADK reply pipeline — a real multi-agent orchestration.

A root `SequentialAgent` runs three specialist sub-agents in order, each handing
its structured output to the next through session state:

  1. ConversationClassifier — reads the thread, classifies the lead's intent.
  2. MeetingExtractor       — decides whether a concrete meeting window was agreed.
  3. ReplyDrafter           — writes the final decision (reply in the lead's language).

The behavior is ported from the single-shot Gemini prompt in
`lib/ai/email-agent.ts`, split across specialists so the orchestration is visible.

Safety note: no sub-agent creates a Google Calendar event. MeetingExtractor only
*proposes* an ISO window; the TypeScript engine materializes the real invite with
the user's OAuth token. No OAuth token ever reaches Python.
"""

from __future__ import annotations

import os

from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.agents.callback_context import CallbackContext

from .logging_config import log_trace
from .schemas import Classification, EmailAgentDecision, MeetingWindow


def _model() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


def _trace_after(state_key: str):
    """Build an after_agent_callback that logs the sub-agent's structured output.

    Emits one Cloud Logging line per sub-agent so the multi-agent orchestration is
    queryable as a trace.
    """

    def _callback(callback_context: CallbackContext):
        log_trace(
            "subagent",
            {
                "agent": callback_context.agent_name,
                "output": callback_context.state.get(state_key),
            },
        )
        return None

    return _callback


CLASSIFIER_INSTRUCTION = """\
You are the intent classifier for an AI SDR doing email prospecting. Read the \
whole thread and classify ONLY the lead's most recent inbound reply.

Choose intent from: interested, objection, question, not_now, negative, opt_out, \
neutral, meeting.

Rules:
- opt_out: the lead asks to unsubscribe, be removed, stop, or "descadastrar".
- negative: the lead is not interested or replies negatively WITHOUT asking to be \
removed. Never use opt_out for a plain "not interested".
- meeting: the lead proposes or accepts talking / scheduling (even if no concrete \
time yet).
- Use the others as they naturally fit.

Output the classification as JSON with intent, confidence (0.0..1.0), and a short \
reasoning. Do not write a reply.
"""

MEETING_EXTRACTOR_INSTRUCTION = """\
You extract a meeting window from an email prospecting thread.

Current date/time (resolve relative references like "amanha", "segunda-feira", \
"semana que vem" against this): {now_iso?}

Upstream classification: {classification?}

A window counts ONLY when the lead has confirmed a concrete date AND time.
- If confirmed, set has_meeting=true and return meeting_start_iso and \
meeting_end_iso in ISO 8601 WITH timezone offset (e.g. 2026-05-30T11:00:00-03:00). \
Default the duration to 30 minutes when the end time is not explicit.
- If the date/time is vague, missing, or still being negotiated, set \
has_meeting=false and leave both timestamps null.

You do NOT create any calendar event — you only propose the window. Output JSON \
matching the schema. Do not write a reply.
"""

REPLY_DRAFTER_INSTRUCTION = """\
You are an AI SDR doing email prospecting. Write the final decision for the latest \
inbound reply. Be objective, polite, and consultative. Never invent calendar links, \
prices, cases, or promises.

Upstream classification: {classification?}
Proposed meeting window: {meeting?}

Rules:
- Preserve the lead's language. Never include a long signature.
- If the classification intent is opt_out, set action="opt_out", \
lead_status="opted_out", and respond only confirming the removal.
- If the intent is negative, set lead_status="negative" and reply briefly and \
respectfully; do not push hard.
- If there is interest but no confirmed window (meeting has_meeting=false), keep \
driving toward agreeing on a concrete time.
- Only set lead_status="meeting_booked" when the proposed window has \
has_meeting=true. In that case copy its meeting_start_iso and meeting_end_iso into \
your decision, and in the body say something like "Perfeito! Vou enviar o convite \
pelo Google Meet para o seu e-mail. Ate la!". The system creates the real Google \
Calendar invite with a Meet link automatically — NEVER ask the lead to send the \
invite and NEVER invent a Meet link yourself.
- Set action="skip" with an empty body only when no response should be sent.
- subject must be a reply subject ("Re: ...").

Output JSON matching the EmailAgentDecision schema:
  action: reply | skip | opt_out
  intent: interested | objection | question | not_now | negative | opt_out | neutral | meeting
  lead_status: replied | interested | meeting_booked | negative | opted_out
  confidence: 0.0..1.0
  follow_up_days: integer days until the next follow-up, or null
  meeting_start_iso / meeting_end_iso: only when lead_status is meeting_booked
"""


def build_reply_agent() -> SequentialAgent:
    classifier = LlmAgent(
        name="conversation_classifier",
        model=_model(),
        instruction=CLASSIFIER_INSTRUCTION,
        output_schema=Classification,
        output_key="classification",
        after_agent_callback=_trace_after("classification"),
    )

    meeting_extractor = LlmAgent(
        name="meeting_extractor",
        model=_model(),
        instruction=MEETING_EXTRACTOR_INSTRUCTION,
        output_schema=MeetingWindow,
        output_key="meeting",
        after_agent_callback=_trace_after("meeting"),
    )

    reply_drafter = LlmAgent(
        name="reply_drafter",
        model=_model(),
        instruction=REPLY_DRAFTER_INSTRUCTION,
        output_schema=EmailAgentDecision,
        output_key="decision",
        after_agent_callback=_trace_after("decision"),
    )

    return SequentialAgent(
        name="reply_pipeline",
        sub_agents=[classifier, meeting_extractor, reply_drafter],
    )
