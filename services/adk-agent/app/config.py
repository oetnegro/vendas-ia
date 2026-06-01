"""Environment configuration.

ADK reads the Gemini key from GOOGLE_API_KEY. We accept GEMINI_API_KEY (the name
the rest of the product already uses) and map it across so a single secret works on
both sides.
"""

from __future__ import annotations

import os


def configure_environment() -> None:
    # Use the Gemini Developer API (not Vertex) unless explicitly overridden.
    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "0")

    gemini_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key and not os.environ.get("GOOGLE_API_KEY"):
        os.environ["GOOGLE_API_KEY"] = gemini_key


SHARED_SECRET = os.environ.get("ADK_SHARED_SECRET", "")
