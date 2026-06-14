import json
import logging
from typing import Any, Dict

import httpx

from config import settings
from utils.prompts import INTELLIGENCE_EXTRACTION_PROMPT

logger = logging.getLogger(__name__)

async def extract_intelligence(transcript: str) -> Dict[str, Any]:
    """Extract structured intelligence from a meeting transcript using Groq LLM.

    The function builds the prompt using ``INTELLIGENCE_EXTRACTION_PROMPT`` and
    calls the Groq chat completion endpoint. If parsing fails it retries once
    with a fallback model. On any error it returns an empty structure.
    """
    prompt = INTELLIGENCE_EXTRACTION_PROMPT.format(transcript=transcript)
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "qwen/qwen3-32b",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 2000,
        "temperature": 0.1,
    }
    async def call_api(model: str) -> str:
        payload["model"] = model
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    try:
        raw = await call_api("qwen/qwen3-32b")
        cleaned = raw.replace("```json", "").replace("```", "").strip()
        result = json.loads(cleaned)
        if not isinstance(result, dict):
            raise ValueError("Response is not a JSON object")
        return result
    except Exception as e:
        logger.warning(f"Primary extraction failed ({e}), retrying with fallback model")
        try:
            raw = await call_api("llama-3.3-70b-versatile")
            cleaned = raw.replace("```json", "").replace("```", "").strip()
            result = json.loads(cleaned)
            if not isinstance(result, dict):
                raise ValueError("Response is not a JSON object")
            return result
        except Exception as e2:
            logger.error(f"Extraction failed: {e2}")
            # Return safe empty dict with expected fields
            return {
                "objections": [],
                "competitors": [],
                "stakeholders": [],
                "action_items": [],
                "budget_signals": [],
                "risks": [],
                "key_decisions": [],
                "sentiment": "neutral",
                "sentiment_score": 0.0,
                "sentiment_reasoning": "",
            }
