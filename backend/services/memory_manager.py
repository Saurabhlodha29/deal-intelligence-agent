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


def _extract_content(memory_obj: dict) -> str:
    """Extract content string from a Hindsight memory object."""
    return (
        memory_obj.get("content")
        or memory_obj.get("text")
        or memory_obj.get("document", {}).get("content", "")
        or memory_obj.get("chunk", {}).get("content", "")
        or memory_obj.get("data", "")
        or ""
    )


def _extract_metadata(memory_obj: dict) -> dict:
    """Extract metadata dict from a Hindsight memory object."""
    return (
        memory_obj.get("metadata")
        or memory_obj.get("meta")
        or memory_obj.get("attributes")
        or {}
    )


async def _store_raw(content: str, metadata: dict) -> Optional[str]:
    """Low-level: store one memory in Hindsight. Returns ID or None on failure."""
    tagged_content = f"[DEAL:{metadata.get('deal_id', 'unknown')}] {content}"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{_bank_url()}/memories",
                headers=_headers(),
                json={
                    "items": [{"content": tagged_content, "context": str(metadata)}],
                    "async": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("bank_id") or data.get("id") or data.get("memory_id")
    except Exception as e:
        logger.error(f"Hindsight store failed: {e}")
        return None


async def _search_raw(query: str, top_k: int = 50) -> list:
    """Low-level: search Hindsight memories. Returns raw list."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{_bank_url()}/memories/recall",
                headers=_headers(),
                json={
                    "query": query,
                    "budget": "mid",
                    "max_tokens": 4096,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("results", [])
    except Exception as e:
        logger.error(f"Hindsight search failed: {e}")
        return []


async def store_episodic_memory(
    deal_id: str,
    meeting_id: str,
    meeting_number: int,
    company: str,
    intelligence: dict,
) -> Optional[str]:
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
    return await _store_raw(content, metadata)


async def store_semantic_memory(
    deal_id: str, company: str, patterns: dict, meeting_number: int
) -> Optional[str]:
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
    return await _store_raw(content, metadata)


async def store_procedural_memory(
    deal_id: str, company: str, strategies: dict, meeting_number: int
) -> Optional[str]:
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
    return await _store_raw(content, metadata)


async def store_action_completion_memory(
    deal_id: str,
    company: str,
    action_item: str,
    resolution_note: str,
    meeting_number: int,
) -> Optional[str]:
    """Store a memory when a sales rep marks an action item as completed."""
    content = (
        f"ACTION COMPLETED (from Meeting #{meeting_number} with {company}):\n"
        f"Task: {action_item}\n"
        f"Resolution: {resolution_note or 'Marked as completed'}\n"
        f"This action was committed to in a previous meeting and has now been fulfilled."
    )
    metadata = {
        "deal_id": deal_id,
        "memory_type": "episodic",
        "memory_subtype": "action_completion",
        "company": company,
        "source_meeting_number": meeting_number,
    }
    return await _store_raw(content, metadata)


async def store_manual_note(
    deal_id: str,
    company: str,
    note: str,
) -> Optional[str]:
    """Store a manually added context note (e.g. 'CFO emailed approval')."""
    content = (
        f"MANUAL CONTEXT NOTE for {company} deal:\n"
        f"{note}\n"
        f"(Added manually by the sales rep — not from a meeting recording)"
    )
    metadata = {
        "deal_id": deal_id,
        "memory_type": "episodic",
        "memory_subtype": "manual_note",
        "company": company,
    }
    return await _store_raw(content, metadata)


async def get_all_deal_memories(deal_id: str) -> dict:
    """Retrieve all memories for a deal from Hindsight."""
    raw = await _search_raw(query=f"[DEAL:{deal_id}]", top_k=100)

    episodic = []
    semantic = []
    procedural = []

    for m in raw:
        content = _extract_content(m)
        meta = _extract_metadata(m)

        # Also check context field (Hindsight stores metadata as stringified dict in context)
        if not meta:
            ctx = m.get("context", "")
            if isinstance(ctx, str) and "deal_id" in ctx:
                # Try to parse stringified dict
                try:
                    import ast
                    meta = ast.literal_eval(ctx)
                except Exception:
                    meta = {}

        content_match = f"[DEAL:{deal_id}]" in content
        meta_match = meta.get("deal_id") == deal_id
        if not content_match and not meta_match:
            continue

        display_content = content.replace(f"[DEAL:{deal_id}] ", "").strip()

        entry = {"content": display_content, "metadata": meta}
        memory_type = meta.get("memory_type", "")

        if memory_type == "episodic":
            episodic.append(entry)
        elif memory_type == "semantic":
            semantic.append(entry)
        elif memory_type == "procedural":
            procedural.append(entry)
        else:
            lower = display_content.lower()
            if "pattern" in lower or "trend" in lower:
                semantic.append(entry)
            elif "strategy" in lower or "works" in lower or "recommend" in lower:
                procedural.append(entry)
            else:
                episodic.append(entry)

    episodic.sort(key=lambda x: x["metadata"].get("meeting_number", 0))
    semantic = semantic[-1:] if semantic else []
    procedural = procedural[-1:] if procedural else []

    return {
        "episodic": episodic,
        "semantic": semantic,
        "procedural": procedural,
        "total_count": len(episodic) + len(semantic) + len(procedural),
    }
