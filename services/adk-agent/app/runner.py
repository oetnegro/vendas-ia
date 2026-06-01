"""Runs the reply agent for one decision request and returns an EmailAgentDecision.

Mirrors the prompt assembly and output normalization of
`generateEmailAgentDecision()` in `lib/ai/email-agent.ts` so the JSON contract is
identical and the TS engine can swap implementations transparently.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone

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


def _build_prompt(request: DecisionRequest) -> str:
    agent = request.agent
    lead = request.lead
    now_iso = datetime.now(timezone.utc).isoformat()
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

    session_id = uuid.uuid4().hex
    await _session_service.create_session(app_name=APP_NAME, user_id="engine", session_id=session_id)
    message = types.Content(role="user", parts=[types.Part(text=_build_prompt(request))])

    steps: list[str] = []
    async for event in _runner.run_async(user_id="engine", session_id=session_id, new_message=message):
        for part in (event.content.parts if event.content else []) or []:
            if getattr(part, "function_call", None):
                steps.append(part.function_call.name)

    session = await _session_service.get_session(
        app_name=APP_NAME, user_id="engine", session_id=session_id
    )
    raw = session.state.get("decision") if session else None
    log_trace("agent_run", {"steps": steps, "lead_email": request.lead.email})

    if not raw:
        # Agent never finalized — signal failure so the TS side falls back.
        raise RuntimeError("Agent did not produce a decision (submit_decision not called).")

    # Prefer the validated meeting window captured by the tool, if present.
    window = (session.state.get("meeting_window") if session else None) or {}

    decision = EmailAgentDecision(
        action=raw.get("action", "reply"),
        intent=raw.get("intent", "neutral"),
        confidence=max(0.0, min(1.0, float(raw.get("confidence") or 0))),
        summary=raw.get("summary", ""),
        subject=_normalize_subject(raw.get("subject") or subject),
        body=(raw.get("body") or "").strip(),
        lead_status=raw.get("lead_status", "replied"),
        follow_up_days=raw.get("follow_up_days"),
        meeting_start_iso=raw.get("meeting_start_iso") or window.get("meeting_start_iso"),
        meeting_end_iso=raw.get("meeting_end_iso") or window.get("meeting_end_iso"),
        reasoning=raw.get("reasoning", ""),
    )
    return decision
