import json
import logging
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from config import settings
from db.client import supabase
from services.memory_manager import get_all_deal_memories
from services.report_generator import generate_report, generate_recommendations
from utils.prompts import BRIEF_GENERATION_PROMPT

logger = logging.getLogger(__name__)
router = APIRouter()


class RecommendRequest(BaseModel):
    context: Optional[str] = None


async def _call_groq_for_brief(prompt: str) -> dict:
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    for model in ["qwen/qwen3-32b", "llama-3.3-70b-versatile"]:
        try:
            async with httpx.AsyncClient(timeout=60) as client:
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
            logger.warning(f"Brief generation with {model} failed: {e}")
    return {}


@router.get("/deals/{deal_id}/memory")
async def get_deal_memory(deal_id: str):
    """Return all Hindsight memories for a deal, separated by type."""
    deal_res = supabase.table("deals").select("id").eq("id", deal_id).execute()
    if not deal_res.data:
        raise HTTPException(status_code=404, detail="Deal not found")

    memories = await get_all_deal_memories(deal_id)
    return memories


@router.get("/deals/{deal_id}/brief")
async def get_deal_brief(deal_id: str):
    """Generate a pre-meeting brief using accumulated memories."""
    deal_res = supabase.table("deals").select("*").eq("id", deal_id).execute()
    if not deal_res.data:
        raise HTTPException(status_code=404, detail="Deal not found")
    deal = deal_res.data[0]
    company = deal["company"]

    # Get all memories
    memories = await get_all_deal_memories(deal_id)
    total_count = memories.get("total_count", 0)

    if total_count == 0:
        return {
            "deal_context": "No meetings processed yet.",
            "meeting_history_summary": "No data available.",
            "recurring_risks": [],
            "recommended_strategies": [],
            "stakeholders_to_know": [],
            "competitor_context": "No data available.",
            "confidence": "low",
            "memory_sources": {"episodic_count": 0, "semantic_count": 0, "procedural_count": 0},
        }

    # Build memory context string
    context_parts = []
    for mem in memories.get("episodic", []):
        context_parts.append(f"[EPISODIC MEMORY]\n{mem.get('content', '')}")
    for mem in memories.get("semantic", []):
        context_parts.append(f"[PATTERNS IDENTIFIED]\n{mem.get('content', '')}")
    for mem in memories.get("procedural", []):
        context_parts.append(f"[WINNING STRATEGIES]\n{mem.get('content', '')}")

    memory_context = "\n\n---\n\n".join(context_parts)

    prompt = BRIEF_GENERATION_PROMPT.format(company=company, memory_context=memory_context)
    brief = await _call_groq_for_brief(prompt)

    # Enrich with memory source counts
    brief["memory_sources"] = {
        "episodic_count": len(memories.get("episodic", [])),
        "semantic_count": len(memories.get("semantic", [])),
        "procedural_count": len(memories.get("procedural", [])),
    }

    return brief


@router.get("/deals/{deal_id}/summary")
def get_deal_summary(deal_id: str):
    """Return the deal_memory_summary row from Supabase (for deal detail sidebar)."""
    deal_res = supabase.table("deals").select("id").eq("id", deal_id).execute()
    if not deal_res.data:
        raise HTTPException(status_code=404, detail="Deal not found")

    summary_res = supabase.table("deal_memory_summary").select("*").eq("deal_id", deal_id).execute()
    if not summary_res.data:
        return {
            "deal_id": deal_id,
            "recurring_objections": [],
            "key_stakeholders": [],
            "competitor_landscape": [],
            "sentiment_trend": "neutral",
            "deal_risk_level": "unknown",
            "winning_strategies": [],
            "total_meetings": 0,
        }
    return summary_res.data[0]


@router.get("/deals/{deal_id}/report")
async def get_deal_report(deal_id: str):
    """Generate a comprehensive deal report with patterns and strategies."""
    deal_res = supabase.table("deals").select("*").eq("id", deal_id).execute()
    if not deal_res.data:
        raise HTTPException(status_code=404, detail="Deal not found")
    deal = deal_res.data[0]

    intel_res = supabase.table("meeting_intelligence").select("*").eq("deal_id", deal_id).execute()
    meeting_intelligences = intel_res.data or []

    summary_res = supabase.table("deal_memory_summary").select("*").eq("deal_id", deal_id).execute()
    deal_summary = summary_res.data[0] if summary_res.data else {}

    memories = await get_all_deal_memories(deal_id)

    report = await generate_report(deal, meeting_intelligences, deal_summary, memories)
    return report


@router.post("/deals/{deal_id}/recommend")
async def get_recommendations(deal_id: str, request: RecommendRequest = None):
    """Generate AI-powered recommendations for the next meeting."""
    deal_res = supabase.table("deals").select("*").eq("id", deal_id).execute()
    if not deal_res.data:
        raise HTTPException(status_code=404, detail="Deal not found")
    deal = deal_res.data[0]

    summary_res = supabase.table("deal_memory_summary").select("*").eq("deal_id", deal_id).execute()
    deal_summary = summary_res.data[0] if summary_res.data else {}

    memories = await get_all_deal_memories(deal_id)

    context = request.context if request else None
    recommendations = await generate_recommendations(deal, deal_summary, memories, context)
    return recommendations