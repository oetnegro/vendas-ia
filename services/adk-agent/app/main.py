"""FastAPI entrypoint for the ADK reply agent (Cloud Run)."""

from __future__ import annotations

from .config import configure_environment

configure_environment()

import os

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse

from . import config
from .logging_config import log_trace
from .runner import run_reply_agent
from .schemas import DecisionRequest, EmailAgentDecision

app = FastAPI(title="Vendas+IA ADK Reply Agent", version="1.0.0")


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "model": os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
        "gemini_key": bool(os.environ.get("GOOGLE_API_KEY")),
        "auth_required": bool(config.SHARED_SECRET),
    }


def _check_auth(provided: str | None) -> None:
    # Fail closed: if no secret is configured the endpoint refuses to serve.
    if not config.SHARED_SECRET:
        raise HTTPException(status_code=503, detail="ADK_SHARED_SECRET not configured.")
    if provided != config.SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing shared secret.")


@app.post("/v1/decide", response_model=EmailAgentDecision)
async def decide(
    request: DecisionRequest,
    x_adk_secret: str | None = Header(default=None, alias="X-ADK-Secret"),
) -> EmailAgentDecision:
    _check_auth(x_adk_secret)
    try:
        decision = await run_reply_agent(request)
        return decision
    except HTTPException:
        raise
    except Exception as error:  # noqa: BLE001 — surface as 502 so TS falls back
        log_trace("decide_error", {"error": str(error)}, severity="ERROR")
        return JSONResponse(status_code=502, content={"error": str(error)})
