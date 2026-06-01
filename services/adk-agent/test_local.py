"""Local smoke test: runs the agent against a sample inbound reply.

Usage:
  GEMINI_API_KEY=... python test_local.py
"""

from __future__ import annotations

import asyncio
import json

from app.config import configure_environment

configure_environment()

from app.runner import run_reply_agent  # noqa: E402
from app.schemas import AgentProfile, DecisionRequest, Lead, Message  # noqa: E402

SAMPLE = DecisionRequest(
    agent=AgentProfile(
        name="Lucas (Vendas+IA)",
        business_context="Plataforma de prospeccao por e-mail com IA para founders de SaaS.",
        campaign_goal="Marcar uma reuniao de 30 minutos para demonstrar o produto.",
        common_objections="Sem tempo; ja uso outra ferramenta.",
    ),
    lead=Lead(
        email="maria@acme.com",
        first_name="Maria",
        last_name="Silva",
        company="Acme",
        title="Head of Growth",
        custom_fields={},
    ),
    messages=[
        Message(
            direction="outbound",
            subject="Primeiros clientes B2B para a Acme",
            body_text="Oi Maria, ajudo founders a conseguir os primeiros clientes. Faz sentido conversar?",
            sent_at="2026-05-30T12:00:00-03:00",
        ),
        Message(
            direction="inbound",
            subject="Re: Primeiros clientes B2B para a Acme",
            body_text="Tenho interesse! Pode ser segunda-feira as 11h?",
            sent_at="2026-06-01T09:00:00-03:00",
        ),
    ],
)


async def main() -> None:
    decision = await run_reply_agent(SAMPLE)
    print(json.dumps(decision.model_dump(), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
