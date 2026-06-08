"""Runs the multi-agent reply pipeline for one request and returns an EmailAgentDecision.

The root `SequentialAgent` (see `agent.py`) runs three specialists in order:
ConversationClassifier -> MeetingExtractor -> ReplyDrafter. Each writes its
structured output to session state; this runner reads the final `decision`,
reconciles the proposed meeting window, and normalizes the output so the JSON
contract is identical to `generateEmailAgentDecision()` in `lib/ai/email-agent.ts`.
The TS engine can swap implementations transparently.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

# Workspace timezone for resolving relative dates ("proxima terca", "amanha") and
# for emitting meeting windows with the right offset. São Paulo is a fixed UTC-3:
# Brazil abolished daylight saving time in 2019, so a constant offset is correct
# year-round and needs no system tz database (the slim image ships without one).
WORKSPACE_TZ = timezone(timedelta(hours=-3))

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from .agent import build_reply_agent
from .logging_config import log_trace
from .schemas import DecisionRequest, EmailAgentDecision, Message

APP_NAME = "vendas-ia-reply"

_agent = build_reply_agent()
_session_service = InMemorySessionService()
_runner = Runner(app_name=APP_NAME, agent=_agent, session_service=_session_service)


def _valid_iso(value: Optional[str]) -> bool:
    if not value:
        return False
    try:
        datetime.fromisoformat(value)
        return True
    except ValueError:
        return False


def _normalize_subject(subject: str | None) -> str:
    cleaned = (subject or "").strip() or "Retorno"
    return cleaned if re.match(r"^re:", cleaned, re.IGNORECASE) else f"Re: {cleaned}"


def _stringify_fields(value) -> str:
    if not isinstance(value, dict):
        return "{}"
    return json.dumps(value, indent=2, ensure_ascii=False)


def _latest_inbound(messages: list[Message]) -> Message | None:
    for message in reversed(messages):
        if message.direction == "inbound" and (message.body_text or "").strip():
            return message
    return None


def _latest_subject(messages: list[Message], inbound: Message | None) -> str | None:
    if inbound and inbound.subject:
        return inbound.subject
    for message in reversed(messages):
        if message.subject:
            return message.subject
    return None


def _build_prompt(request: DecisionRequest, now_iso: str) -> str:
    agent = request.agent
    lead = request.lead
    full_name = " ".join(filter(None, [lead.first_name, lead.last_name])) or "Nao informado"

    history = "\n\n---\n\n".join(
        f"[{'Nosso agente' if m.direction == 'outbound' else 'Lead'} | "
        f"{m.sent_at or 'sem data'} | {m.subject or 'sem assunto'}]\n{m.body_text or ''}"
        for m in request.messages
    )

    return "\n\n".join(
        [
            f'Data e hora atual (use para resolver referencias relativas como "amanha", '
            f'"semana que vem", "segunda-feira"): {now_iso}',
            f"Agente: {agent.name}",
            f"Contexto do negocio:\n{agent.business_context or 'Nao informado.'}",
            f"Objetivo da campanha:\n{agent.campaign_goal or 'Marcar uma reuniao qualificada.'}",
            f"Objecoes comuns e respostas esperadas:\n{agent.common_objections or 'Nao informado.'}",
            (
                f"Lead:\nNome: {full_name}\nEmail: {lead.email}\n"
                f"Empresa: {lead.company or 'Nao informada'}\n"
                f"Cargo: {lead.title or 'Nao informado'}\n"
                f"Campos extras: {_stringify_fields(lead.custom_fields)}"
            ),
            f"Historico da thread, em ordem cronologica:\n{history}",
        ]
    )


def _skip_decision(subject: str | None, summary: str, reasoning: str) -> EmailAgentDecision:
    return EmailAgentDecision(
        action="skip",
        intent="neutral",
        confidence=1.0,
        summary=summary,
        subject=_normalize_subject(subject),
        body="",
        lead_status="replied",
        follow_up_days=None,
        meeting_start_iso=None,
        meeting_end_iso=None,
        reasoning=reasoning,
    )


async def run_reply_agent(request: DecisionRequest) -> EmailAgentDecision:
    inbound = _latest_inbound(request.messages)
    subject = _latest_subject(request.messages, inbound)

    if inbound is None:
        return _skip_decision(
            subject,
            "Nao existe resposta recebida para processar.",
            "Thread sem mensagem inbound.",
        )

    now_iso = datetime.now(WORKSPACE_TZ).isoformat()
    session_id = uuid.uuid4().hex
    await _session_service.create_session(
        app_name=APP_NAME,
        user_id="engine",
        session_id=session_id,
        state={"now_iso": now_iso},
    )
    message = types.Content(role="user", parts=[types.Part(text=_build_prompt(request, now_iso))])

    steps: list[str] = []
    async for event in _runner.run_async(user_id="engine", session_id=session_id, new_message=message):
        if event.author and event.author not in steps:
            steps.append(event.author)

    session = await _session_service.get_session(
        app_name=APP_NAME, user_id="engine", session_id=session_id
    )
    state = session.state if session else {}
    raw = state.get("decision")
    log_trace(
        "pipeline_run",
        {
            "steps": steps,
            "lead_email": request.lead.email,
            "classification": state.get("classification"),
            "meeting": state.get("meeting"),
        },
    )

    if not raw:
        # ReplyDrafter never finalized — signal failure so the TS side falls back.
        raise RuntimeError("Pipeline did not produce a decision (no 'decision' in state).")

    # Reconcile the meeting window: trust MeetingExtractor's validated proposal.
    # Only a confirmed window with valid ISO timestamps is allowed to book.
    meeting = state.get("meeting") or {}
    window_valid = bool(
        meeting.get("has_meeting")
        and _valid_iso(meeting.get("meeting_start_iso"))
        and _valid_iso(meeting.get("meeting_end_iso"))
    )

    lead_status = raw.get("lead_status", "replied")
    meeting_start_iso = None
    meeting_end_iso = None
    if window_valid:
        meeting_start_iso = meeting["meeting_start_iso"]
        meeting_end_iso = meeting["meeting_end_iso"]
    elif lead_status == "meeting_booked":
        # Drafter claimed a booking the extractor did not confirm — don't book.
        lead_status = "interested"

    decision = EmailAgentDecision(
        action=raw.get("action", "reply"),
        intent=raw.get("intent", "neutral"),
        confidence=max(0.0, min(1.0, float(raw.get("confidence") or 0))),
        summary=raw.get("summary", ""),
        subject=_normalize_subject(raw.get("subject") or subject),
        body=(raw.get("body") or "").strip(),
        lead_status=lead_status,
        follow_up_days=raw.get("follow_up_days"),
        meeting_start_iso=meeting_start_iso,
        meeting_end_iso=meeting_end_iso,
        reasoning=raw.get("reasoning", ""),
    )
    return decision
