import json
import logging
import httpx
from typing import Dict, Any, List

from config import settings
from utils.prompts import REPORT_GENERATION_PROMPT, RECOMMENDATION_PROMPT

logger = logging.getLogger(__name__)


async def generate_report(
    deal: dict,
    meeting_intelligences: List[dict],
    deal_summary: dict,
    memories: dict,
) -> Dict[str, Any]:
    """Generate a comprehensive deal report using Groq LLM.

    Combines all meeting intelligence, deal summary, and Hindsight memories
    into a structured report with executive summary, patterns, and strategies.
    """
    context_parts = []

    context_parts.append(f"Deal: {deal.get('name', 'Unknown')} with {deal.get('company', 'Unknown')}")
    context_parts.append(f"Stage: {deal.get('stage', 'unknown')}")
    context_parts.append(f"Value: ${deal.get('deal_value', 0):,.2f}")

    if deal_summary:
        context_parts.append(f"\nDeal Summary:")
        context_parts.append(f"Risk Level: {deal_summary.get('deal_risk_level', 'unknown')}")
        context_parts.append(f"Sentiment Trend: {deal_summary.get('sentiment_trend', 'neutral')}")
        context_parts.append(f"Total Meetings: {deal_summary.get('total_meetings', 0)}")

    if meeting_intelligences:
        context_parts.append(f"\nMeeting Intelligence ({len(meeting_intelligences)} meetings):")
        for i, intel in enumerate(meeting_intelligences, 1):
            context_parts.append(f"\nMeeting {i}:")
            context_parts.append(f"  Sentiment: {intel.get('sentiment', 'neutral')} (score: {intel.get('sentiment_score', 0)})")
            if intel.get('objections'):
                context_parts.append(f"  Objections: {json.dumps(intel['objections'], indent=2)}")
            if intel.get('stakeholders'):
                context_parts.append(f"  Stakeholders: {json.dumps(intel['stakeholders'], indent=2)}")
            if intel.get('competitors'):
                context_parts.append(f"  Competitors: {json.dumps(intel['competitors'], indent=2)}")
            if intel.get('risks'):
                context_parts.append(f"  Risks: {json.dumps(intel['risks'], indent=2)}")

    for mem_type in ['episodic', 'semantic', 'procedural']:
        mems = memories.get(mem_type, [])
        if mems:
            context_parts.append(f"\n{mem_type.title()} Memories ({len(mems)} records):")
            for mem in mems[:3]:
                content = mem.get('content', '')
                if content:
                    context_parts.append(f"  - {content[:200]}...")

    memory_context = "\n".join(context_parts)

    prompt = REPORT_GENERATION_PROMPT.format(memory_context=memory_context)

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    for model in ["qwen/qwen3-32b", "llama-3.3-70b-versatile"]:
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 2000,
                        "temperature": 0.2,
                    },
                )
                resp.raise_for_status()
                raw = resp.json()["choices"][0]["message"]["content"]
                cleaned = raw.replace("```json", "").replace("```", "").strip()
                return json.loads(cleaned)
        except Exception as e:
            logger.warning(f"Report generation with {model} failed: {e}")

    return {
        "executive_summary": "Report generation failed. Please try again.",
        "deal_health": "at_risk",
        "risk_level": "medium",
        "patterns": [],
        "winning_strategies": [],
        "next_steps": [],
        "memory_timeline": [],
    }


async def generate_recommendations(
    deal: dict,
    deal_summary: dict,
    memories: dict,
    context: str = None,
) -> Dict[str, Any]:
    """Generate AI-powered recommendations for the next meeting.

    Uses accumulated memories and deal summary to suggest strategies.
    """
    context_parts = []

    context_parts.append(f"Deal: {deal.get('name', 'Unknown')} with {deal.get('company', 'Unknown')}")
    context_parts.append(f"Stage: {deal.get('stage', 'unknown')}")

    if deal_summary:
        context_parts.append(f"\nDeal Summary:")
        context_parts.append(f"Risk Level: {deal_summary.get('deal_risk_level', 'unknown')}")
        context_parts.append(f"Sentiment Trend: {deal_summary.get('sentiment_trend', 'neutral')}")
        if deal_summary.get('winning_strategies'):
            context_parts.append(f"Winning Strategies: {json.dumps(deal_summary['winning_strategies'], indent=2)}")
        if deal_summary.get('recurring_objections'):
            context_parts.append(f"Recurring Objections: {json.dumps(deal_summary['recurring_objections'], indent=2)}")

    for mem_type in ['episodic', 'semantic', 'procedural']:
        mems = memories.get(mem_type, [])
        if mems:
            context_parts.append(f"\n{mem_type.title()} Memories ({len(mems)} records):")
            for mem in mems[:3]:
                content = mem.get('content', '')
                if content:
                    context_parts.append(f"  - {content[:200]}...")

    if context:
        context_parts.append(f"\nAdditional Context: {context}")

    memory_context = "\n".join(context_parts)

    prompt = RECOMMENDATION_PROMPT.format(memory_context=memory_context)

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    for model in ["qwen/qwen3-32b", "llama-3.3-70b-versatile"]:
        try:
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers=headers,
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 1500,
                        "temperature": 0.3,
                    },
                )
                resp.raise_for_status()
                raw = resp.json()["choices"][0]["message"]["content"]
                cleaned = raw.replace("```json", "").replace("```", "").strip()
                return json.loads(cleaned)
        except Exception as e:
            logger.warning(f"Recommendation generation with {model} failed: {e}")

    return {
        "recommendations": [],
        "confidence": "low",
    }
