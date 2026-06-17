import json
import logging
import httpx
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from config import settings
from db.client import supabase
from services.memory_manager import get_all_deal_memories, store_action_completion_memory, store_manual_note
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
        for attempt in range(3):
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
                    if resp.status_code == 429:
                        wait = 2 ** attempt * 2
                        logger.warning(f"Rate limited on {model} (attempt {attempt+1}), waiting {wait}s")
                        await asyncio.sleep(wait)
                        continue
                    resp.raise_for_status()
                    body = resp.json()
                    choices = body.get("choices", [])
                    if not choices or not choices[0].get("message", {}).get("content"):
                        logger.warning(f"Empty response from {model} (attempt {attempt+1})")
                        await asyncio.sleep(2)
                        continue
                    raw = choices[0]["message"]["content"]
                    cleaned = raw.replace("```json", "").replace("```", "").strip()
                    if not cleaned:
                        logger.warning(f"Empty cleaned content from {model}")
                        await asyncio.sleep(2)
                        continue
                    return json.loads(cleaned)
            except httpx.RemoteProtocolError:
                wait = 2 ** attempt * 2
                logger.warning(f"Connection error on {model} (attempt {attempt+1}), waiting {wait}s")
                await asyncio.sleep(wait)
            except Exception as e:
                logger.warning(f"Brief generation with {model} failed: {e}")
                break
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
async def get_deal_summary(deal_id: str):
    """Return the deal_memory_summary row from Supabase (for deal detail sidebar)."""
    for attempt in range(3):
        try:
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
        except httpx.RemoteProtocolError:
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)
                continue
            raise
        except HTTPException:
            raise
        except Exception as e:
            if attempt < 2 and "Connection" in str(e):
                await asyncio.sleep(2 ** attempt)
                continue
            raise


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


@router.post("/meetings/{meeting_id}/complete-action-item")
async def complete_action_item(meeting_id: str, payload: dict):
    """Mark an action item as completed and store the completion in Hindsight memory."""
    try:
        deal_id = payload.get("deal_id", "")
        company = payload.get("company", "Unknown")
        action_item_text = payload.get("action_item_text", "")
        resolution_note = payload.get("resolution_note", "")
        meeting_number = payload.get("meeting_number", 1)
        action_item_index = payload.get("action_item_index", 0)

        if not deal_id or not action_item_text:
            raise HTTPException(status_code=400, detail="deal_id and action_item_text are required")

        # Update the action item in Supabase to mark as completed
        intel_res = (
            supabase.table("meeting_intelligence")
            .select("action_items")
            .eq("meeting_id", meeting_id)
            .execute()
        )
        if intel_res.data:
            action_items = intel_res.data[0].get("action_items", [])
            if 0 <= action_item_index < len(action_items):
                action_items[action_item_index]["completed"] = True
                action_items[action_item_index]["resolution_note"] = resolution_note
                supabase.table("meeting_intelligence").update(
                    {"action_items": action_items}
                ).eq("meeting_id", meeting_id).execute()

        # Store the completion as a new episodic memory in Hindsight
        memory_id = await store_action_completion_memory(
            deal_id=deal_id,
            company=company,
            action_item=action_item_text,
            resolution_note=resolution_note,
            meeting_number=meeting_number,
        )

        return {
            "success": True,
            "memory_stored": memory_id is not None,
            "memory_id": memory_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"complete_action_item failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deals/{deal_id}/add-note")
async def add_manual_note(deal_id: str, payload: dict):
    """Add a manual context note that gets stored directly in Hindsight memory."""
    try:
        note = payload.get("note", "").strip()
        if not note:
            raise HTTPException(status_code=400, detail="note cannot be empty")

        # Get company name
        deal_res = supabase.table("deals").select("company, name").eq("id", deal_id).execute()
        if not deal_res.data:
            raise HTTPException(status_code=404, detail="Deal not found")
        company = deal_res.data[0]["company"]

        # Store in Hindsight
        memory_id = await store_manual_note(
            deal_id=deal_id,
            company=company,
            note=note,
        )

        return {
            "success": True,
            "memory_stored": memory_id is not None,
            "memory_id": memory_id,
            "message": "Note saved to agent memory. It will appear in your next pre-meeting brief.",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"add_manual_note failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))