"""Structured logging for Cloud Logging.

Cloud Run captures stdout/stderr. When a log line is a JSON object, Cloud Logging
parses it into structured fields (jsonPayload) and reads `severity`. We emit one
JSON line per agent step so the multi-step decision trace is queryable and can feed
the evals épico.
"""

from __future__ import annotations

import json
import logging
import sys
from typing import Any

_logger = logging.getLogger("adk-reply-agent")

if not _logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    _logger.addHandler(handler)
    _logger.setLevel(logging.INFO)
    _logger.propagate = False


def log_trace(step: str, payload: dict[str, Any], severity: str = "INFO") -> None:
    """Emit one structured trace line for an agent step."""
    _logger.info(
        json.dumps(
            {
                "severity": severity,
                "component": "adk-reply-agent",
                "step": step,
                **payload,
            },
            ensure_ascii=False,
            default=str,
        )
    )
