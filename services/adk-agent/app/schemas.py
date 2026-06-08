"""Pydantic schemas.

`EmailAgentDecision` mirrors the TypeScript type in `lib/ai/email-agent.ts` field
for field so the ADK service is a drop-in swap for `generateEmailAgentDecision()`.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

Action = Literal["reply", "skip", "opt_out"]
Intent = Literal[
    "interested",
    "objection",
    "question",
    "not_now",
    "negative",
    "opt_out",
    "neutral",
    "meeting",
]
LeadStatus = Literal[
    "replied",
    "interested",
    "meeting_booked",
    "negative",
    "opted_out",
]


class Classification(BaseModel):
    """ConversationClassifier output — the lead's intent for this inbound reply."""

    intent: Intent
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str


class MeetingWindow(BaseModel):
    """MeetingExtractor output — a proposed meeting window, if one was confirmed.

    The window is only a proposal. The TypeScript engine materializes the real
    Google Calendar event with the user's OAuth token; no token ever reaches Python.
    """

    has_meeting: bool
    meeting_start_iso: Optional[str] = None
    meeting_end_iso: Optional[str] = None


class AgentProfile(BaseModel):
    name: str
    business_context: Optional[str] = None
    common_objections: Optional[str] = None
    campaign_goal: Optional[str] = None


class Lead(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    custom_fields: Any = None


class Message(BaseModel):
    direction: Literal["inbound", "outbound"]
    subject: Optional[str] = None
    body_text: Optional[str] = None
    sent_at: Optional[str] = None


class DecisionRequest(BaseModel):
    agent: AgentProfile
    lead: Lead
    messages: list[Message]


class EmailAgentDecision(BaseModel):
    action: Action
    intent: Intent
    confidence: float = Field(ge=0.0, le=1.0)
    summary: str
    subject: str
    body: str
    lead_status: LeadStatus
    follow_up_days: Optional[int] = None
    meeting_start_iso: Optional[str] = None
    meeting_end_iso: Optional[str] = None
    reasoning: str
