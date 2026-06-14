import json
import logging
import httpx
from datetime import datetime
from config import settings
from utils.prompts import PATTERN_DETECTION_PROMPT
from services.memory_manager import (
    store_semantic_memory,
    store_procedural_memory,
)

logger = logging.getLogger(__name__)

async def _call_groq(prompt: str) -> dict:
    """Call Groq LLM and parse JSON response."""
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
                        "temperature": 0.1,
                    },
                )
                resp.raise_for_status()
                raw = resp.json()["choices"][0]["message"]["content"]
                cleaned = raw.replace("```json", "").replace("```", "").strip()
                return json.loads(cleaned)
        except Exception as e:
            logger.warning(f"Pattern detection with {model} failed: {e}")
    return {}

async def detect_and_store_patterns(deal_id: str, supabase) -> dict:
    """
    Fetch all meeting_intelligence for a deal, detect patterns,
    store semantic and procedural memories in Hindsight,
    and update deal_memory_summary in Supabase.

    Returns the patterns dict (or empty dict on failure).
    """
    try:
        # 1. Fetch deal info
        deal_res = supabase.table("deals").select("company, name").eq("id", deal_id).execute()
        if not deal_res.data:
            logger.error(f"Deal {deal_id} not found for pattern detection")
            return {}
        company = deal_res.data[0]["company"]

        # 2. Fetch all meeting intelligence for this deal
        intel_res = (
            supabase.table("meeting_intelligence")
            .select("*")
            .eq("deal_id", deal_id)
            .execute()
        )
        all_intel = intel_res.data or []
        meeting_count = len(all_intel)

        if meeting_count == 0:
            return {}

        # Also get meeting numbers
        meetings_res = (
            supabase.table("meetings")
            .select("id, meeting_number")
            .eq("deal_id", deal_id)
            .execute()
        )
        meeting_number_map = {m["id"]: m.get("meeting_number", 0) for m in (meetings_res.data or [])}

        # 3. Build summary of all intelligence for the prompt
        intel_summary = []
        for idx, intel in enumerate(all_intel):
            meeting_id = intel.get("meeting_id", "")
            mnum = meeting_number_map.get(meeting_id, idx + 1)
            intel_summary.append({
                "meeting_number": mnum,
                "objections": intel.get("objections", []),
                "competitors": intel.get("competitors", []),
                "stakeholders": intel.get("stakeholders", []),
                "budget_signals": intel.get("budget_signals", []),
                "risks": intel.get("risks", []),
                "sentiment": intel.get("sentiment", "neutral"),
                "sentiment_score": intel.get("sentiment_score", 0),
            })

        # 4. Determine current meeting number (highest)
        current_meeting_number = max(
            meeting_number_map.get(intel.get("meeting_id", ""), 0)
            for intel in all_intel
        ) if all_intel else 1

        patterns = {}

        # 5. Detect patterns if 2+ meetings
        if meeting_count >= 2:
            prompt = PATTERN_DETECTION_PROMPT.format(
                company=company,
                meeting_count=meeting_count,
                meeting_data=json.dumps(intel_summary, indent=2),
            )
            patterns = await _call_groq(prompt)

            if patterns:
                await store_semantic_memory(
                    deal_id=deal_id,
                    company=company,
                    patterns=patterns,
                    meeting_number=current_meeting_number,
                )

        # 6. Store procedural memory if 3+ meetings
        if meeting_count >= 3 and patterns:
            await store_procedural_memory(
                deal_id=deal_id,
                company=company,
                strategies=patterns,
                meeting_number=current_meeting_number,
            )

        # 7. Update deal_memory_summary in Supabase
        last_intel = intel_res.data[-1] if intel_res.data else {}

        # Build recurring_objections: objections that appear in >1 meeting
        all_objection_texts = []
        for intel in all_intel:
            for obj in intel.get("objections", []):
                all_objection_texts.append(obj.get("text", ""))

        from collections import Counter
        objection_counts = Counter(all_objection_texts)
        recurring_objections = [
            {"text": text, "count": count}
            for text, count in objection_counts.most_common(5)
            if count > 1
        ]

        # Build key_stakeholders from all meetings
        stakeholder_map = {}
        for intel in all_intel:
            for s in intel.get("stakeholders", []):
                name = s.get("name", "Unknown")
                if name not in stakeholder_map:
                    stakeholder_map[name] = s
                else:
                    # Update with latest sentiment
                    stakeholder_map[name]["sentiment"] = s.get("sentiment", stakeholder_map[name].get("sentiment"))

        # Build competitor landscape
        competitor_mentions = []
        for intel in all_intel:
            for c in intel.get("competitors", []):
                competitor_mentions.append(c.get("name", ""))
        competitor_counts = Counter(competitor_mentions)
        competitor_landscape = [
            {"name": name, "mention_count": count}
            for name, count in competitor_counts.most_common()
        ]

        summary_data = {
            "deal_id": deal_id,
            "recurring_objections": recurring_objections,
            "key_stakeholders": list(stakeholder_map.values()),
            "competitor_landscape": competitor_landscape,
            "sentiment_trend": patterns.get("sentiment_trend", "stable"),
            "deal_risk_level": patterns.get("deal_risk_level", "medium"),
            "winning_strategies": [
                {"strategy": w} for w in patterns.get("what_works", [])
            ],
            "missed_opportunities": [
                {"issue": w} for w in patterns.get("what_doesnt_work", [])
            ],
            "total_meetings": meeting_count,
            "last_meeting_date": datetime.utcnow().isoformat(),
            "last_updated": datetime.utcnow().isoformat(),
        }

        # Upsert (insert or update) deal_memory_summary
        existing = (
            supabase.table("deal_memory_summary")
            .select("id")
            .eq("deal_id", deal_id)
            .execute()
        )
        if existing.data:
            supabase.table("deal_memory_summary").update(summary_data).eq("deal_id", deal_id).execute()
        else:
            supabase.table("deal_memory_summary").insert(summary_data).execute()

        return patterns

    except Exception as e:
        logger.error(f"Pattern detection failed for deal {deal_id}: {e}")
        return {}