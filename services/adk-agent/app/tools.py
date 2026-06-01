"""Agent tools.

The reply agent is multi-step: it must call `classify_intent`, optionally
`create_calendar_event`, and finally `submit_decision`. Each call is written to
session state so the runner can read the authoritative result and so every step
shows up as a structured trace entry in Cloud Logging.

`create_calendar_event` does NOT create a Google Calendar event here. The user's
OAuth token lives on the TypeScript/Supabase side and is intentionally never moved
into Python. This tool validates and returns the meeting window; the TS engine
creates the real event with the user's token (same as today).
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from google.adk.tools import ToolContext

from .logging_config import log_trace


def _valid_iso(value: Optional[str]) -> bool:
    if not value:
        return False
    try:
        datetime.fromisoformat(value)
        return True
    except ValueError:
        return False


def classify_intent(
    intent: str,
    confidence: float,
    reasoning: str,
    tool_context: ToolContext,
) -> dict:
    """Record the classification of the lead's latest inbound reply.

    Call this FIRST, before deciding on a response. Choose `intent` from:
    interested, objection, question, not_now, negative, opt_out, neutral, meeting.

    Args:
        intent: The classified intent of the lead's reply.
        confidence: Confidence between 0.0 and 1.0.
        reasoning: Short justification for the classification.
    """
    classification = {
        "intent": intent,
        "confidence": confidence,
        "reasoning": reasoning,
    }
    tool_context.state["classification"] = classification
    log_trace("classify_intent", classification)
    next_hint = (
        "Lead shows scheduling intent. If a concrete date AND time are present, call "
        "create_calendar_event next; otherwise keep negotiating a time in the reply."
        if intent in ("meeting", "interested")
        else "Proceed to submit_decision."
    )
    return {"status": "ok", "next": next_hint}


def create_calendar_event(
    start_iso: str,
    end_iso: str,
    tool_context: ToolContext,
) -> dict:
    """Propose a confirmed meeting window for the TS engine to materialize.

    Only call this when the lead has confirmed a concrete date AND time. Provide
    ISO 8601 datetimes WITH timezone offset (e.g. 2026-05-30T11:00:00-03:00).
    Default duration is 30 minutes when the end time is not explicit.

    This does not create the event. The TypeScript engine creates the real Google
    Calendar invite (with Meet link) using the user's OAuth token and emails it to
    the lead. In the reply body, tell the lead the invite will be sent — never ask
    the lead to send it and never invent a Meet link yourself.
    """
    if not _valid_iso(start_iso) or not _valid_iso(end_iso):
        log_trace("create_calendar_event", {"error": "invalid_iso", "start_iso": start_iso, "end_iso": end_iso})
        return {
            "status": "invalid",
            "message": "start_iso/end_iso must be valid ISO 8601 with timezone. Keep asking for a clear time.",
        }
    window = {"meeting_start_iso": start_iso, "meeting_end_iso": end_iso}
    tool_context.state["meeting_window"] = window
    log_trace("create_calendar_event", window)
    return {"status": "ok", **window}


def submit_decision(
    action: str,
    intent: str,
    confidence: float,
    summary: str,
    subject: str,
    body: str,
    lead_status: str,
    reasoning: str,
    tool_context: ToolContext,
    follow_up_days: Optional[int] = None,
    meeting_start_iso: Optional[str] = None,
    meeting_end_iso: Optional[str] = None,
) -> dict:
    """Submit the final decision. Call this exactly once, as the last step.

    Fields mirror the EmailAgentDecision contract consumed by the app:
      - action: reply | skip | opt_out
      - intent: interested | objection | question | not_now | negative | opt_out | neutral | meeting
      - lead_status: replied | interested | meeting_booked | negative | opted_out
      - confidence: 0.0..1.0
      - follow_up_days: integer days until next follow-up, or null
      - meeting_start_iso / meeting_end_iso: only when lead_status is meeting_booked
    """
    decision = {
        "action": action,
        "intent": intent,
        "confidence": confidence,
        "summary": summary,
        "subject": subject,
        "body": body,
        "lead_status": lead_status,
        "follow_up_days": follow_up_days,
        "meeting_start_iso": meeting_start_iso,
        "meeting_end_iso": meeting_end_iso,
        "reasoning": reasoning,
    }
    tool_context.state["decision"] = decision
    log_trace("submit_decision", {"action": action, "intent": intent, "lead_status": lead_status})
    return {"status": "ok"}
