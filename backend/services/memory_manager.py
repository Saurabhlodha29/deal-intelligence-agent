import httpx
import logging
from typing import Optional
from config import settings

logger = logging.getLogger(__name__)

HINDSIGHT_BASE_URL = "https://api.hindsight.vectorize.io/v1"

def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.HINDSIGHT_API_KEY}",
        "Content-Type": "application/json",
    }

def _bank_url() -> str:
    return f"{HINDSIGHT_BASE_URL}/default/banks/{settings.HINDSIGHT_PIPELINE_ID}"

async def store_memory(content: str, metadata: dict) -> Optional[str]:
    """Store a single memory in Hindsight. Returns memory ID or None on failure."""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{_bank_url()}/memories",
                headers=_headers(),
                json={
                    "items": [{"content": content, "context": str(metadata)}],
                    "async": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("bank_id")
    except Exception as e:
        logger.error(f"Hindsight store_memory failed: {e}")
        return None

async def search_memories(query: str, filter_metadata: Optional[dict] = None, top_k: int = 20) -> list:
    """Search Hindsight memories with optional metadata filter."""
    try:
        payload = {
            "query": query,
            "budget": "mid",
            "max_tokens": 4096,
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{_bank_url()}/memories/recall",
                headers=_headers(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("results", [])
    except Exception as e:
        logger.error(f"Hindsight search failed: {e}")
        return []

async def get_memories_by_filter(filter_metadata: dict) -> list:
    """Retrieve all memories matching exact metadata fields."""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(
                f"{_bank_url()}/memories/list",
                headers=_headers(),
                params={"limit": 100},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("items", [])
    except Exception as e:
        logger.error(f"Hindsight get_memories failed: {e}")
        return []

async def store_episodic_memory(
    deal_id: str,
    meeting_id: str,
    meeting_number: int,
    company: str,
    intelligence: dict,
) -> Optional[str]:
    """Store a per-meeting episodic memory."""
    objections_text = "; ".join(
        o.get("text", "") for o in intelligence.get("objections", [])
    ) or "None raised"
    competitors_text = "; ".join(
        c.get("name", "") for c in intelligence.get("competitors", [])
    ) or "None mentioned"
    stakeholders_text = "; ".join(
        f"{s.get('name')} ({s.get('role')}, {s.get('sentiment')} sentiment)"
        for s in intelligence.get("stakeholders", [])
    ) or "None identified"
    action_items_text = "; ".join(
        a.get("item", "") for a in intelligence.get("action_items", [])
    ) or "None"
    sentiment = intelligence.get("sentiment", "unknown")
    sentiment_reasoning = intelligence.get("sentiment_reasoning", "")

    content = (
        f"Meeting #{meeting_number} with {company}.\n"
        f"Objections raised: {objections_text}\n"
        f"Competitors mentioned: {competitors_text}\n"
        f"Key stakeholders: {stakeholders_text}\n"
        f"Action items agreed: {action_items_text}\n"
        f"Overall meeting sentiment: {sentiment}. {sentiment_reasoning}"
    )

    metadata = {
        "deal_id": deal_id,
        "meeting_id": meeting_id,
        "memory_type": "episodic",
        "meeting_number": meeting_number,
        "company": company,
        "sentiment": sentiment,
    }
    return await store_memory(content, metadata)

async def store_semantic_memory(
    deal_id: str,
    company: str,
    patterns: dict,
    meeting_number: int,
) -> Optional[str]:
    """Store or update cross-meeting pattern memory."""
    content = (
        f"Patterns identified across meetings with {company}:\n\n"
        f"PRICING PATTERN: {patterns.get('pricing_pattern') or 'No pricing pattern yet'}\n\n"
        f"STAKEHOLDER PATTERN: {patterns.get('stakeholder_pattern') or 'Insufficient data'}\n\n"
        f"COMPETITOR PATTERN: {patterns.get('competitor_pattern') or 'No competitors identified yet'}\n\n"
        f"SENTIMENT TREND: {patterns.get('sentiment_trend', 'stable')}\n\n"
        f"DEAL RISK LEVEL: {patterns.get('deal_risk_level', 'medium')} — "
        f"{patterns.get('deal_risk_reasoning', '')}"
    )
    metadata = {
        "deal_id": deal_id,
        "memory_type": "semantic",
        "company": company,
        "updated_after_meeting": meeting_number,
    }
    return await store_memory(content, metadata)

async def store_procedural_memory(
    deal_id: str,
    company: str,
    strategies: dict,
    meeting_number: int,
) -> Optional[str]:
    """Store or update strategy/procedural memory."""
    what_works = "\n".join(f"• {w}" for w in strategies.get("what_works", []))
    what_doesnt = "\n".join(f"• {w}" for w in strategies.get("what_doesnt_work", []))
    next_steps = "\n".join(f"• {s}" for s in strategies.get("recommended_next_steps", []))

    content = (
        f"Sales strategies for {company} deal:\n\n"
        f"WHAT WORKS:\n{what_works or 'Insufficient data yet'}\n\n"
        f"WHAT DOES NOT WORK:\n{what_doesnt or 'Insufficient data yet'}\n\n"
        f"RECOMMENDED NEXT STEPS:\n{next_steps or 'Continue gathering data'}"
    )
    metadata = {
        "deal_id": deal_id,
        "memory_type": "procedural",
        "company": company,
        "derived_after_meeting": meeting_number,
    }
    return await store_memory(content, metadata)

async def get_all_deal_memories(deal_id: str) -> dict:
    """Return all memory types for a deal, separated by type."""
    all_memories = await search_memories(
        query=f"deal memory {deal_id}",
        filter_metadata={"deal_id": deal_id},
        top_k=50,
    )

    episodic = []
    semantic = []
    procedural = []

    for m in all_memories:
        meta = m.get("metadata", {})
        memory_type = meta.get("memory_type", "")
        entry = {
            "content": m.get("content", m.get("text", "")),
            "metadata": meta,
        }
        if memory_type == "episodic":
            episodic.append(entry)
        elif memory_type == "semantic":
            semantic.append(entry)
        elif memory_type == "procedural":
            procedural.append(entry)

    episodic.sort(key=lambda x: x["metadata"].get("meeting_number", 0))

    return {
        "episodic": episodic,
        "semantic": semantic,
        "procedural": procedural,
        "total_count": len(all_memories),
    }