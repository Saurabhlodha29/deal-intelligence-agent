"""
Seed realistic demo data for the Deal Intelligence Agent hackathon demo.

Run from the project root:
    cd backend && python ../scripts/seed_demo_data.py

Requires:
    - .env file in backend/ with all credentials
    - Supabase tables already created
    - Hindsight pipeline set up
"""

import sys
import os
import asyncio
from datetime import datetime, timedelta

# Add backend to path so we can import from it
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

# Load .env from backend directory
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

from db.client import supabase
from services.memory_manager import store_episodic_memory
from services.pattern_detector import detect_and_store_patterns


# ── Demo deal data ──────────────────────────────────────────────────────────

DEAL = {
    "name": "Enterprise Platform Deal",
    "company": "TechCorp Solutions",
    "contact_name": "Michael Torres",
    "contact_role": "VP of Engineering",
    "deal_value": 120000.00,
    "currency": "USD",
    "stage": "negotiation",
    "notes": "Strategic enterprise account. Decision expected end of Q1."
}

MEETINGS = [
    {
        "title": "Initial Discovery Call",
        "days_ago": 18,
        "number": 1,
        "transcript": "Michael Torres joined the call. We introduced our platform capabilities. Michael seemed excited about the automation features. He mentioned they're currently using spreadsheets and it's becoming unmanageable. He asked about integration with Salesforce. No pricing discussed yet. Good energy overall.",
        "intelligence": {
            "objections": [
                {"text": "We need to ensure this integrates with our existing Salesforce setup", "severity": "medium", "was_handled": True}
            ],
            "competitors": [],
            "stakeholders": [
                {"name": "Michael Torres", "role": "VP of Engineering", "sentiment": "positive", "influence": "high"}
            ],
            "action_items": [
                {"item": "Send Salesforce integration documentation", "owner": "us", "deadline": "end of week"}
            ],
            "budget_signals": [],
            "risks": [],
            "key_decisions": [],
            "sentiment": "positive",
            "sentiment_score": 0.7,
            "sentiment_reasoning": "Michael was engaged and enthusiastic throughout. Strong initial interest with minimal friction."
        }
    },
    {
        "title": "Technical Deep Dive",
        "days_ago": 12,
        "number": 2,
        "transcript": "Technical review session. Michael brought in Sarah Chen, their CFO, halfway through. When Sarah joined she immediately asked about total cost of ownership. Michael demonstrated our Salesforce migration would be complex but manageable. Sarah raised concerns that enterprise tier pricing seemed high for their Q1 budget cycle. We didn't have a good answer for the phased pricing question she asked.",
        "intelligence": {
            "objections": [
                {"text": "Enterprise tier pricing is too high for our current Q1 budget", "severity": "high", "was_handled": False}
            ],
            "competitors": [
                {"name": "Salesforce", "context": "Current incumbent system they are considering migrating away from"}
            ],
            "stakeholders": [
                {"name": "Michael Torres", "role": "VP of Engineering", "sentiment": "neutral", "influence": "high"},
                {"name": "Sarah Chen", "role": "CFO", "sentiment": "skeptical", "influence": "high"}
            ],
            "action_items": [
                {"item": "Prepare phased pricing proposal for CFO review", "owner": "us", "deadline": "this week"}
            ],
            "budget_signals": [
                {"signal": "CFO mentioned tight Q1 budget constraints", "type": "negative"}
            ],
            "risks": [
                {"risk": "CFO Sarah Chen has high influence and is skeptical on pricing", "severity": "high"}
            ],
            "key_decisions": [],
            "sentiment": "mixed",
            "sentiment_score": 0.05,
            "sentiment_reasoning": "Positive technical engagement but CFO introduction introduced significant pricing friction."
        }
    },
    {
        "title": "Pricing and ROI Review",
        "days_ago": 6,
        "number": 3,
        "transcript": "Sarah Chen led this meeting. She opened with the statement that our price is approximately 40% over what they had budgeted for this project. She also raised the implementation timeline as a concern, saying 6 months is too long for her Q1 plans. Michael pushed back on Sarah slightly saying the ROI justifies the cost. HubSpot was also brought up as an alternative they evaluated. We talked about Salesforce migration costs but didn't have specific numbers. Sarah asked us to send a phased pricing proposal breaking the cost over two quarters.",
        "intelligence": {
            "objections": [
                {"text": "Your price is approximately 40% over our budgeted amount for this project", "severity": "high", "was_handled": False},
                {"text": "6 month implementation timeline is too long for our Q1 deadline", "severity": "medium", "was_handled": False}
            ],
            "competitors": [
                {"name": "Salesforce", "context": "Prospect discussing migration cost from Salesforce as barrier to switching"},
                {"name": "HubSpot", "context": "Evaluated as alternative but rejected for missing enterprise features"}
            ],
            "stakeholders": [
                {"name": "Sarah Chen", "role": "CFO", "sentiment": "skeptical", "influence": "high"},
                {"name": "Michael Torres", "role": "VP of Engineering", "sentiment": "positive", "influence": "medium"}
            ],
            "action_items": [
                {"item": "Send phased pricing proposal splitting cost across Q1 and Q3", "owner": "us", "deadline": "Friday"},
                {"item": "Provide specific Salesforce migration cost comparison", "owner": "us", "deadline": "Friday"}
            ],
            "budget_signals": [
                {"signal": "Current budget is approximately 40% below our enterprise list price", "type": "negative"},
                {"signal": "Open to splitting cost across quarters if proposal is structured correctly", "type": "positive"}
            ],
            "risks": [
                {"risk": "Deal may stall if phased pricing not accepted by CFO", "severity": "high"},
                {"risk": "Implementation timeline mismatch with Q1 deadline", "severity": "medium"}
            ],
            "key_decisions": [],
            "sentiment": "mixed",
            "sentiment_score": -0.15,
            "sentiment_reasoning": "CFO-led meeting with explicit pricing blocker. Michael's internal advocacy is positive but CFO holds budget authority."
        }
    },
    {
        "title": "ROI Presentation and Proposal Review",
        "days_ago": 1,
        "number": 4,
        "transcript": "We presented the phased pricing: 48,000 in Q1 and 72,000 in Q3. Sarah Chen responded positively to the phased structure. We directly addressed the Salesforce comparison with a cost analysis showing they would save 35,000 in migration costs. Michael was enthusiastic. Sarah asked for legal to review the contract terms before final sign-off. James Liu from their legal team joined for the last 20 minutes. James had standard questions about data residency and SLAs. We ended with a tentative verbal agreement pending legal review next week.",
        "intelligence": {
            "objections": [
                {"text": "Legal team needs to review contract terms before final commitment", "severity": "low", "was_handled": True}
            ],
            "competitors": [
                {"name": "Salesforce", "context": "Addressed head-on with cost comparison showing 35,000 in migration savings"}
            ],
            "stakeholders": [
                {"name": "Sarah Chen", "role": "CFO", "sentiment": "neutral", "influence": "high"},
                {"name": "Michael Torres", "role": "VP of Engineering", "sentiment": "positive", "influence": "high"},
                {"name": "James Liu", "role": "Legal Counsel", "sentiment": "neutral", "influence": "medium"}
            ],
            "action_items": [
                {"item": "Legal team to complete contract review", "owner": "both", "deadline": "next week"},
                {"item": "Send final phased pricing deck with data residency addendum", "owner": "us", "deadline": "tomorrow"},
                {"item": "Schedule follow-up call after legal review", "owner": "us", "deadline": "next week"}
            ],
            "budget_signals": [
                {"signal": "Phased pricing 48K Q1 + 72K Q3 was received positively by CFO", "type": "positive"},
                {"signal": "Cost comparison showing 35K Salesforce migration savings was compelling", "type": "positive"}
            ],
            "risks": [
                {"risk": "Legal review could introduce new blockers or delay timeline", "severity": "low"}
            ],
            "key_decisions": [
                {"decision": "Verbal agreement in principle pending legal review"}
            ],
            "sentiment": "positive",
            "sentiment_score": 0.6,
            "sentiment_reasoning": "Strong recovery from pricing friction. Phased model and Salesforce comparison addressed CFO concerns effectively."
        }
    }
]


async def seed():
    print("\nSeeding Deal Intelligence Agent demo data...\n")

    # ── Step 1: Create deal ────────────────────────────────────────────────
    print("Creating deal: TechCorp Solutions Enterprise Platform Deal")
    existing = supabase.table("deals").select("id").eq("name", DEAL["name"]).execute()
    if existing.data:
        deal_id = existing.data[0]["id"]
        print(f"   Deal already exists. ID: {deal_id}")
    else:
        res = supabase.table("deals").insert(DEAL).execute()
        deal_id = res.data[0]["id"]
        company = res.data[0]["company"]
        hindsight_tags = [f"deal:{deal_id}", f"company:{company.lower().replace(' ', '_')}"]
        supabase.table("deals").update({"hindsight_tags": hindsight_tags}).eq("id", deal_id).execute()
        print(f"   Created. ID: {deal_id}")

    # ── Step 2: Create meetings and intelligence ───────────────────────────
    meeting_ids = []
    for m in MEETINGS:
        title = m["title"]
        meeting_date = (datetime.utcnow() - timedelta(days=m["days_ago"])).isoformat()

        # Check if already seeded
        existing_m = supabase.table("meetings").select("id").eq("deal_id", deal_id).eq("title", title).execute()
        if existing_m.data:
            mid = existing_m.data[0]["id"]
            print(f"Meeting '{title}' already exists. ID: {mid}")
            meeting_ids.append(mid)
            continue

        print(f"Creating meeting: {title}")
        meeting_res = supabase.table("meetings").insert({
            "deal_id": deal_id,
            "title": title,
            "meeting_date": meeting_date,
            "meeting_number": m["number"],
            "processing_status": "complete",
            "transcript": m["transcript"],
        }).execute()
        mid = meeting_res.data[0]["id"]
        meeting_ids.append(mid)

        # Save intelligence
        intel = m["intelligence"]
        intel_record = {
            "meeting_id": mid,
            "deal_id": deal_id,
            "objections": intel["objections"],
            "competitors": intel["competitors"],
            "stakeholders": intel["stakeholders"],
            "action_items": intel["action_items"],
            "budget_signals": intel["budget_signals"],
            "risks": intel["risks"],
            "key_decisions": intel["key_decisions"],
            "sentiment": intel["sentiment"],
            "sentiment_score": intel["sentiment_score"],
            "sentiment_reasoning": intel["sentiment_reasoning"],
            "raw_extraction": intel,
        }
        supabase.table("meeting_intelligence").insert(intel_record).execute()
        print(f"   Saved intelligence. Meeting ID: {mid}")

    # ── Step 3: Store all Hindsight memories ─────────────────────────────
    print("\nStoring Hindsight memories...")
    for i, m in enumerate(MEETINGS):
        mid = meeting_ids[i]
        print(f"   Storing episodic memory for meeting #{m['number']}...")
        await store_episodic_memory(
            deal_id=deal_id,
            meeting_id=mid,
            meeting_number=m["number"],
            company="TechCorp Solutions",
            intelligence=m["intelligence"],
        )

    print("\nRunning pattern detection (semantic + procedural memory)...")
    patterns = await detect_and_store_patterns(deal_id=deal_id, supabase=supabase)
    if patterns:
        print(f"   Patterns detected. Risk level: {patterns.get('deal_risk_level', 'unknown')}")
    else:
        print("   Pattern detection returned empty (check Hindsight API logs)")

    # ── Done ───────────────────────────────────────────────────────────────
    print(f"\nSeeding complete!")
    print(f"\n   Deal ID: {deal_id}")
    print(f"   Company: TechCorp Solutions")
    print(f"   Meetings seeded: {len(MEETINGS)}")
    print(f"\n   Open the app and navigate to this deal to see full memory timeline")
    print(f"   URL will be: http://localhost:3000/deals/{deal_id}")
    print(f"   Pre-Meeting Brief: http://localhost:3000/deals/{deal_id}/brief")
    print(f"   Memory Timeline: http://localhost:3000/deals/{deal_id}/memory\n")


if __name__ == "__main__":
    asyncio.run(seed())