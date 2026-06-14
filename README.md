# Deal Intelligence Agent

## Master Architecture Document v2.0

### Hackathon Edition — CTO Approved

> **How to use this document:**
> This is the single source of truth for the entire project. Read it fully before writing a single line of code. Share it with Claude, Antigravity, and ChatGPT at the start of every session using the section titled "How to Maintain Context Across Tools."

---

## TABLE OF CONTENTS

- [Output 1: Final Architecture v2](#output-1-final-architecture-v2)
- [Output 2: Final Tech Stack Decisions](#output-2-final-tech-stack-decisions)
- [Output 3: Project Folder Structure](#output-3-project-folder-structure)
- [Output 4: Database Design](#output-4-database-design)
- [Output 5: Hindsight Memory Design](#output-5-hindsight-memory-design)
- [Output 6: API Design](#output-6-api-design)
- [Output 7: System Design Explanation](#output-7-system-design-explanation)
- [Output 8: Master Context Document (Summary)](#output-8-master-context-document-summary)
- [Output 9: Development Roadmap](#output-9-development-roadmap)
- [Output 10–15: Antigravity Prompts 1–6](#output-10-antigravity-prompt-1-project-initialization)
- [Output 16: Demo-Day Strategy](#output-16-demo-day-strategy)
- [Output 17: Debugging Strategy](#output-17-debugging-strategy)
- [Output 18: Context Maintenance Across Tools](#output-18-context-maintenance-across-tools)
- [Output 19: Risk Register](#output-19-risk-register)
- [Output 20: Final CTO Critique](#output-20-final-cto-critique)

---

# OUTPUT 1: FINAL ARCHITECTURE v2

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                          │
│                      Next.js + Tailwind + shadcn/ui             │
│                                                                 │
│  [Deal Dashboard] [Meeting Recorder] [Memory Timeline]          │
│  [Pre-Meeting Brief] [Intelligence Report] [Strategy Cards]     │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP REST (JSON)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                           │
│                     FastAPI (Python)                            │
│                                                                 │
│  /api/v1/deals      → Deal CRUD Service                         │
│  /api/v1/meetings   → Meeting Service + Audio Upload            │
│  /api/v1/intelligence → Intelligence + Brief + Report Service   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  PROCESSING PIPELINE                     │   │
│  │                                                          │   │
│  │  Audio → [Groq Whisper STT] → Transcript                │   │
│  │                   ↓                                      │   │
│  │  Transcript → [Groq LLM Extraction] → Intelligence JSON │   │
│  │                   ↓                                      │   │
│  │  Intelligence → [Memory Updater] → Hindsight + Supabase │   │
│  │                   ↓                                      │   │
│  │  Memory Query → [Report Generator] → Brief / Report     │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────┬─────────────────────────┬───────────────────────────┘
            │                         │
            ▼                         ▼
┌───────────────────────┐   ┌─────────────────────────────────────┐
│     DATA LAYER        │   │         MEMORY LAYER                │
│     Supabase          │   │         Hindsight                   │
│     (PostgreSQL)      │   │                                     │
│                       │   │  [Episodic]  → Meeting events       │
│  deals                │   │  [Semantic]  → Cross-meeting        │
│  meetings             │   │              patterns               │
│  meeting_intelligence │   │  [Procedural]→ Winning strategies   │
│  deal_memory_summary  │   │                                     │
│                       │   │  Powered by:                        │
└───────────────────────┘   │  Semantic search + retrieval        │
                            └─────────────────────────────────────┘
```

## Data Flow (Post-Meeting)

```
1. User clicks "End Meeting"
2. Browser sends audio blob → POST /api/v1/meetings/{id}/upload
3. FastAPI receives audio → calls Groq Whisper → gets transcript
4. Transcript → Groq LLM extraction prompt → structured intelligence JSON
5. Intelligence JSON → saved to Supabase (meeting_intelligence table)
6. Intelligence JSON → Hindsight episodic memory stored
7. All deal memories queried → pattern detection → semantic memory updated
8. Strategies derived → procedural memory updated
9. deal_memory_summary table updated
10. Frontend polls status → shows "Processing Complete" → renders report
```

## Data Flow (Pre-Meeting Brief)

```
1. User clicks "Get Brief" for upcoming meeting
2. GET /api/v1/deals/{deal_id}/brief
3. FastAPI queries Hindsight: all memories tagged with deal_id
4. Memories (all 3 types) sent to Groq LLM with brief generation prompt
5. Structured brief returned: context summary, risk flags, recommended strategy
6. Frontend renders brief in PreMeetingBrief component
```

---

# OUTPUT 2: FINAL TECH STACK DECISIONS

## Every Decision Explained

### Speech-to-Text: ✅ GROQ WHISPER (FINAL DECISION)

**Comparison:**

| Factor        | Faster Whisper (local) | Groq Whisper       | AssemblyAI |
| ------------- | ---------------------- | ------------------ | ---------- |
| Speed         | Medium (CPU-bound)     | Very Fast (10x RT) | Fast       |
| Setup         | Complex (GPU/install)  | Zero setup         | Moderate   |
| Cost          | Free but slow          | Free tier generous | Paid       |
| Demo safety   | Risky (local fails)    | High               | High       |
| Hackathon fit | Poor                   | Excellent          | Good       |
| API key       | None needed            | Same as LLM        | Separate   |

**Decision: Groq Whisper (`whisper-large-v3`)**

Reasons:

- You already have a Groq API key for the LLM. One key, two services.
- No local setup. Local Whisper fails on demo day.
- Groq's Whisper is the fastest hosted implementation available.
- Free tier: 7,200 requests/day audio minutes on Whisper. More than enough.
- Endpoint: `https://api.groq.com/openai/v1/audio/transcriptions`
- Model string: `whisper-large-v3`

**How to get credentials:**

1. Go to https://console.groq.com/
2. Sign up / log in
3. Navigate to API Keys → Create API Key
4. Copy key → store as `GROQ_API_KEY` in your `.env` file
5. Same key used for both Whisper (STT) and LLM (chat completions)

**Integration approach:**

```python
# services/transcription.py
import httpx

async def transcribe_audio(audio_bytes: bytes, filename: str) -> str:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
            files={"file": (filename, audio_bytes, "audio/webm")},
            data={"model": "whisper-large-v3", "response_format": "text"},
            timeout=120.0
        )
        response.raise_for_status()
        return response.text
```

**Common mistakes:**

- ❌ Sending JSON body instead of multipart/form-data
- ❌ File size exceeds 25MB (compress frontend audio; demo recordings are short)
- ❌ Wrong Content-Type header (let httpx set it automatically with `files=`)
- ❌ Not handling timeout (set 120s minimum)

**Demo-day precaution:** Pre-record a 3-minute test audio and run it through Groq Whisper the night before to confirm your API key works and rate limits are not hit.

---

### LLM: Groq (qwen/qwen3-32b + llama-3.3-70b-versatile fallback)

- **Primary model:** `qwen/qwen3-32b` (recommended by hackathon, strong at structured output)
- **Fallback model:** `llama-3.3-70b-versatile` (reliable, widely tested)
- **Secondary model:** `openai/gpt-oss-120b` for complex report synthesis if available

Use `qwen/qwen3-32b` for intelligence extraction (structured JSON output). Switch to `llama-3.3-70b-versatile` if function calling errors occur — the hackathon brief warns about this.

### Frontend: Next.js 14 + Tailwind CSS + shadcn/ui

- App Router architecture
- shadcn/ui for all UI components
- No SSR needed for most pages (CSR is fine for hackathon)

### Backend: FastAPI (Python 3.11+)

- Async endpoints throughout
- Pydantic v2 models for validation
- `python-multipart` for audio upload handling

### Database: Supabase (PostgreSQL)

- Use Supabase Python client (`supabase-py`)
- Antigravity can create tables via Supabase MCP
- Store all structured data here; Hindsight stores only memory/intelligence

### Memory: Hindsight Cloud

- Use promo code `MEMHACK6` at billing for $50 free credits
- Create one pipeline per deal (or use metadata filtering on a shared pipeline)
- Python SDK or REST API

### Environment Variables Required:

```bash
# .env (backend)
GROQ_API_KEY=gsk_...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
HINDSIGHT_API_KEY=...
HINDSIGHT_PIPELINE_ID=...

# .env.local (frontend)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

# OUTPUT 3: PROJECT FOLDER STRUCTURE

```
deal-intelligence-agent/
│
├── README.md                          # Project overview + setup instructions
├── .env.example                       # Template for all env vars (no real values)
├── .gitignore
│
├── backend/                           # FastAPI application
│   ├── requirements.txt               # All Python dependencies
│   ├── main.py                        # FastAPI app entry point, CORS, router mounts
│   ├── config.py                      # Settings class reading from .env
│   │
│   ├── api/                           # Route handlers (thin layer, no business logic)
│   │   ├── __init__.py
│   │   ├── deals.py                   # CRUD endpoints for deals
│   │   ├── meetings.py                # Meeting creation + audio upload endpoint
│   │   └── intelligence.py            # Brief, report, memory, recommendations
│   │
│   ├── services/                      # All business logic lives here
│   │   ├── __init__.py
│   │   ├── transcription.py           # Groq Whisper integration
│   │   ├── intelligence_extractor.py  # Groq LLM → structured intelligence JSON
│   │   ├── memory_manager.py          # All Hindsight read/write operations
│   │   ├── pattern_detector.py        # Derives semantic + procedural memories
│   │   └── report_generator.py        # Generates briefs and full reports
│   │
│   ├── models/                        # Pydantic schemas (request/response types)
│   │   ├── __init__.py
│   │   ├── deal.py                    # DealCreate, DealResponse, DealUpdate
│   │   ├── meeting.py                 # MeetingCreate, MeetingResponse, ProcessingStatus
│   │   └── intelligence.py            # IntelligenceResult, Brief, Report, Memory
│   │
│   ├── db/
│   │   ├── __init__.py
│   │   ├── client.py                  # Supabase client singleton
│   │   └── migrations/
│   │       └── 001_initial_schema.sql # All CREATE TABLE statements
│   │
│   └── utils/
│       ├── __init__.py
│       └── prompts.py                 # All LLM prompt templates (centralized)
│
├── frontend/                          # Next.js application
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   │
│   ├── app/                           # Next.js App Router
│   │   ├── layout.tsx                 # Root layout with fonts and global styles
│   │   ├── page.tsx                   # Dashboard: list of all deals
│   │   ├── globals.css
│   │   │
│   │   └── deals/
│   │       ├── page.tsx               # Create deal form
│   │       └── [dealId]/
│   │           ├── page.tsx           # Deal detail: meetings list + memory panel
│   │           ├── meeting/
│   │           │   └── [meetingId]/
│   │           │       └── page.tsx   # Meeting detail: transcript + intelligence
│   │           ├── brief/
│   │           │   └── page.tsx       # Pre-meeting brief page
│   │           └── memory/
│   │               └── page.tsx       # Memory timeline visualization
│   │
│   ├── components/
│   │   ├── ui/                        # shadcn/ui generated components
│   │   │
│   │   ├── deals/
│   │   │   ├── DealCard.tsx           # Card in dashboard list
│   │   │   ├── CreateDealModal.tsx    # Modal form to create a new deal
│   │   │   └── DealStagesBadge.tsx    # Stage indicator (discovery → closed)
│   │   │
│   │   ├── meetings/
│   │   │   ├── MeetingRecorder.tsx    # Record button, timer, audio capture
│   │   │   ├── ProcessingStatus.tsx   # Spinner with step progress labels
│   │   │   ├── TranscriptViewer.tsx   # Scrollable transcript display
│   │   │   └── MeetingCard.tsx        # Meeting row in deal's meeting list
│   │   │
│   │   ├── intelligence/
│   │   │   ├── IntelligenceReport.tsx # Full post-meeting intelligence display
│   │   │   ├── ObjectionsList.tsx     # Objections with severity badges
│   │   │   ├── CompetitorTags.tsx     # Competitor chip display
│   │   │   ├── StakeholderGrid.tsx    # Stakeholder cards with sentiment
│   │   │   ├── ActionItemsList.tsx    # Checkable action items
│   │   │   └── RiskIndicator.tsx      # Risk level with color coding
│   │   │
│   │   ├── memory/
│   │   │   ├── MemoryTimeline.tsx     # ⭐ THE DEMO CENTERPIECE — memory evolution
│   │   │   ├── EpisodicMemoryCard.tsx # "What happened" memory card
│   │   │   ├── SemanticMemoryCard.tsx # "What patterns emerged" card
│   │   │   └── ProceduralMemoryCard.tsx # "What strategies work" card
│   │   │
│   │   └── brief/
│   │       ├── PreMeetingBrief.tsx    # Full brief layout
│   │       ├── ContextSummary.tsx     # Past meetings summary
│   │       ├── RiskFlags.tsx          # Risks to watch in this meeting
│   │       └── StrategyCards.tsx      # Recommended tactics
│   │
│   ├── lib/
│   │   ├── api.ts                     # All backend fetch calls (typed)
│   │   ├── utils.ts                   # cn() and helpers
│   │   └── types.ts                   # All shared TypeScript interfaces
│   │
│   └── public/
│       └── demo-data/
│           └── seed-script.ts         # Seeds realistic demo data into backend
│
├── docs/
│   ├── architecture.md                # Diagrams and architecture decisions
│   ├── api-reference.md               # Endpoint documentation
│   └── demo-guide.md                  # Step-by-step demo script
│
└── scripts/
    └── seed_demo_data.py              # Python script to seed 4 realistic meetings
```

---

# OUTPUT 4: DATABASE DESIGN

## Complete SQL Schema

```sql
-- ============================================================
-- FILE: backend/db/migrations/001_initial_schema.sql
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- DEALS TABLE
-- One row per sales deal being tracked
-- ============================================================
CREATE TABLE deals (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    company         VARCHAR(255) NOT NULL,
    contact_name    VARCHAR(255),
    contact_role    VARCHAR(255),
    deal_value      DECIMAL(12, 2),
    currency        VARCHAR(3) DEFAULT 'USD',
    stage           VARCHAR(50) DEFAULT 'discovery',
    -- Valid stages: discovery, qualification, proposal, negotiation, closed_won, closed_lost
    hindsight_tags  JSONB DEFAULT '[]',
    -- Array of tag strings used to filter Hindsight memories for this deal
    -- e.g. ["deal:abc123", "company:techcorp"]
    notes           TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- MEETINGS TABLE
-- One row per recorded/tracked meeting within a deal
-- ============================================================
CREATE TABLE meetings (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    deal_id             UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    title               VARCHAR(255),
    meeting_date        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duration_seconds    INTEGER,
    transcript          TEXT,
    audio_url           TEXT,
    -- processing_status tracks the async processing pipeline:
    -- pending → transcribing → extracting → storing_memory → complete | failed
    processing_status   VARCHAR(50) DEFAULT 'pending',
    processing_error    TEXT,
    meeting_number      INTEGER,
    -- Sequential number within this deal (1st meeting, 2nd meeting, etc.)
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- MEETING_INTELLIGENCE TABLE
-- Structured intelligence extracted from a single meeting
-- ============================================================
CREATE TABLE meeting_intelligence (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    meeting_id      UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    deal_id         UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,

    -- Each of these is a JSONB array of structured objects
    objections      JSONB DEFAULT '[]',
    -- [{"text": "Too expensive", "severity": "high", "was_handled": false}]

    competitors     JSONB DEFAULT '[]',
    -- [{"name": "Salesforce", "context": "Prospect mentioned using Salesforce currently"}]

    stakeholders    JSONB DEFAULT '[]',
    -- [{"name": "Sarah Chen", "role": "CFO", "sentiment": "skeptical", "influence": "high"}]

    action_items    JSONB DEFAULT '[]',
    -- [{"item": "Send ROI calculator", "owner": "us", "deadline": "Friday"}]

    budget_signals  JSONB DEFAULT '[]',
    -- [{"signal": "Working with tight budget this quarter", "type": "negative"}]

    risks           JSONB DEFAULT '[]',
    -- [{"risk": "Decision delayed to Q2", "severity": "medium"}]

    key_decisions   JSONB DEFAULT '[]',
    -- [{"decision": "Will involve legal team in next meeting"}]

    sentiment               VARCHAR(20),
    -- positive | neutral | negative | mixed
    sentiment_score         DECIMAL(4, 3),
    -- -1.000 to +1.000
    sentiment_reasoning     TEXT,

    raw_extraction  JSONB,
    -- Full LLM output stored for debugging / re-processing

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- DEAL_MEMORY_SUMMARY TABLE
-- Aggregated intelligence snapshot across all meetings for a deal
-- Updated after every meeting is processed
-- ============================================================
CREATE TABLE deal_memory_summary (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    deal_id                 UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE UNIQUE,

    recurring_objections    JSONB DEFAULT '[]',
    -- [{"text": "Pricing too high", "count": 3, "meetings": [1, 2, 4]}]

    key_stakeholders        JSONB DEFAULT '[]',
    -- [{"name": "Sarah Chen", "role": "CFO", "overall_sentiment": "cautious",
    --   "is_decision_maker": true}]

    competitor_landscape    JSONB DEFAULT '[]',
    -- [{"name": "Salesforce", "mention_count": 3, "competitive_angle": "incumbent"}]

    sentiment_trend         VARCHAR(20) DEFAULT 'neutral',
    -- improving | declining | stable | volatile

    deal_risk_level         VARCHAR(20) DEFAULT 'medium',
    -- low | medium | high | critical

    winning_strategies      JSONB DEFAULT '[]',
    -- [{"strategy": "Lead with ROI first", "evidence": "Positive response in meeting 3"}]

    missed_opportunities    JSONB DEFAULT '[]',
    -- [{"issue": "Did not address Salesforce pricing comparison"}]

    total_meetings          INTEGER DEFAULT 0,
    last_meeting_date       TIMESTAMP WITH TIME ZONE,
    last_updated            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_meetings_deal_id ON meetings(deal_id);
CREATE INDEX idx_meeting_intelligence_meeting_id ON meeting_intelligence(meeting_id);
CREATE INDEX idx_meeting_intelligence_deal_id ON meeting_intelligence(deal_id);
CREATE INDEX idx_deal_memory_summary_deal_id ON deal_memory_summary(deal_id);

-- ============================================================
-- AUTO-UPDATE TRIGGER FOR updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_deals_updated_at
    BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_meetings_updated_at
    BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
```

## Key Design Decisions

1. **JSONB for arrays**: Objections, competitors, etc. are stored as JSONB. This avoids excessive joins while keeping data queryable and flexible.
2. **deal_memory_summary is a single-row-per-deal aggregate**: This is what gets displayed in the UI as "what the agent has learned." Rebuilt after every meeting.
3. **hindsight_tags on deals**: These are the filter tags used to retrieve Hindsight memories for a specific deal without needing per-deal pipelines.
4. **processing_status state machine**: The UI uses this to show progress steps. Never guess status — always query this field.

---

# OUTPUT 5: HINDSIGHT MEMORY DESIGN

## Memory Architecture (Practical, Not Academic)

We use Hindsight as a semantic memory store that evolves with each meeting. The three memory types are NOT separate databases — they are different types of records stored in the same Hindsight pipeline, distinguished by metadata.

### One Hindsight Pipeline

Create ONE pipeline for the entire project. Filter by `deal_id` metadata tag on every query. This is simpler than creating per-deal pipelines and avoids pipeline management complexity.

### Memory Type 1: Episodic Memory

**When stored:** Immediately after each meeting is processed.
**What it captures:** The specific, factual events of that one meeting.
**Hindsight metadata tag:** `memory_type: "episodic"`

```python
# Example episodic memory content (what gets stored in Hindsight)
episodic_content = """
Meeting #3 with TechCorp (2024-01-20).
Key events:
- CFO Sarah Chen joined for first time. She expressed budget concerns for Q1.
- Pricing objection raised: "Your enterprise tier is 40% over our budget."
- Competitor Salesforce mentioned: prospect is currently using it and comparing.
- Action items: We agreed to send a phased pricing proposal by Friday.
- Meeting ended on a cautiously positive note. Sarah asked about implementation timeline.
"""

hindsight_metadata = {
    "deal_id": "deal_abc123",
    "company": "TechCorp",
    "memory_type": "episodic",
    "meeting_number": 3,
    "meeting_date": "2024-01-20",
    "sentiment": "mixed"
}
```

### Memory Type 2: Semantic Memory

**When stored:** After the 2nd meeting, and updated after each subsequent meeting.
**What it captures:** Patterns that have emerged across multiple meetings.
**Hindsight metadata tag:** `memory_type: "semantic"`

```python
# Example semantic memory content (updated after meeting 3)
semantic_content = """
Patterns identified across 3 meetings with TechCorp:

PRICING PATTERN: Pricing concerns raised in 2 of 3 meetings (meetings 2 and 3).
This is a recurring blocker. The prospect consistently references budget constraints.

STAKEHOLDER PATTERN: CFO Sarah Chen is the primary financial decision-maker.
She appeared in meeting 3 and immediately raised budget objections.
She has high influence and skeptical sentiment.

COMPETITOR PATTERN: Salesforce mentioned in meetings 2 and 3.
Prospect is an existing Salesforce user comparing migration cost vs. value.

SENTIMENT TREND: Improving overall (meetings 1→2→3: neutral → mixed → cautiously positive)
despite pricing friction.
"""

hindsight_metadata = {
    "deal_id": "deal_abc123",
    "company": "TechCorp",
    "memory_type": "semantic",
    "last_updated_after_meeting": 3,
    "pattern_types": ["pricing", "stakeholder", "competitor"]
}
```

### Memory Type 3: Procedural Memory

**When stored:** After 3+ meetings, when enough evidence exists to derive strategies.
**What it captures:** What approaches work and don't work for this specific deal.
**Hindsight metadata tag:** `memory_type: "procedural"`

```python
# Example procedural memory content
procedural_content = """
Strategies and tactics derived from TechCorp deal history:

WHAT WORKS:
- Opening with implementation success stories builds credibility (positive response in meeting 2)
- Focusing on ROI and cost-of-inaction keeps CFO engaged
- Phased pricing proposals reduce sticker shock on enterprise tier

WHAT DOESN'T WORK:
- Leading with feature lists causes disengagement (meeting 1 feedback)
- Skipping the Salesforce comparison leaves prospect unconvinced
- Ignoring Q1 budget cycles creates avoidable objections

RECOMMENDED APPROACH FOR NEXT MEETING:
- Present phased pricing model first
- Directly address Salesforce migration cost with data
- Get CFO Sarah Chen commitment before end of meeting
"""

hindsight_metadata = {
    "deal_id": "deal_abc123",
    "company": "TechCorp",
    "memory_type": "procedural",
    "confidence": "medium",
    "derived_after_meeting": 3
}
```

### Memory Query for Pre-Meeting Brief

```python
async def get_deal_memories(deal_id: str) -> dict:
    """
    Query all three memory types for a deal.
    Returns structured memory for brief generation.
    """
    all_memories = await hindsight_client.search(
        query=f"TechCorp deal history objections strategies",
        filter={"deal_id": deal_id},
        top_k=20
    )

    episodic = [m for m in all_memories if m.metadata.get("memory_type") == "episodic"]
    semantic  = [m for m in all_memories if m.metadata.get("memory_type") == "semantic"]
    procedural = [m for m in all_memories if m.metadata.get("memory_type") == "procedural"]

    return {
        "episodic": episodic,
        "semantic": semantic,
        "procedural": procedural
    }
```

### Memory Evolution Visualization (Key Demo Feature)

The frontend `MemoryTimeline` component shows:

```
Meeting 1     Meeting 2          Meeting 3              Meeting 4
    │             │                   │                      │
  [E1]         [E1][E2]          [E1][E2][E3]         [E1][E2][E3][E4]
               [S1 created]      [S1 updated]         [S1 updated]
                                 [P1 created]         [P1 updated]

E = Episodic memory   S = Semantic memory   P = Procedural memory

After Meeting 1: 1 memory (raw events)
After Meeting 2: 3 memories (2 episodic + 1 semantic pattern emerges)
After Meeting 3: 5 memories (3 episodic + 1 semantic updated + 1 procedural appears)
After Meeting 4: 6 memories (4 episodic + 1 semantic + 1 procedural, all updated)
```

This progression is what judges need to see. Build this visualization.

---

# OUTPUT 6: API DESIGN

## Complete REST API Reference

### Base URL: `http://localhost:8000/api/v1`

---

### Deals

```
GET    /deals
       Response: { deals: Deal[] }

POST   /deals
       Body: { name, company, contact_name, contact_role, deal_value, stage }
       Response: Deal

GET    /deals/{deal_id}
       Response: Deal (with meeting count and memory_summary)

PUT    /deals/{deal_id}
       Body: Partial<DealCreate>
       Response: Deal

DELETE /deals/{deal_id}
       Response: { success: true }
```

---

### Meetings

```
POST   /deals/{deal_id}/meetings
       Body: { title, meeting_date }
       Response: Meeting (status: pending)

GET    /deals/{deal_id}/meetings
       Response: { meetings: Meeting[] }

GET    /meetings/{meeting_id}
       Response: Meeting (with intelligence if complete)

POST   /meetings/{meeting_id}/upload
       Body: multipart/form-data with field "audio" (webm/mp4/mp3 file)
       Response: { meeting_id, status: "transcribing" }
       Notes:
         - Triggers async processing pipeline
         - Poll /status for updates

GET    /meetings/{meeting_id}/status
       Response: {
         meeting_id: string,
         status: "pending" | "transcribing" | "extracting" |
                 "storing_memory" | "complete" | "failed",
         step_message: string,
         error?: string
       }

GET    /meetings/{meeting_id}/intelligence
       Response: MeetingIntelligence (only available when status = complete)
```

---

### Intelligence & Memory

```
GET    /deals/{deal_id}/brief
       Response: {
         deal_context: string,
         meeting_history_summary: string,
         recurring_risks: Risk[],
         recommended_strategies: Strategy[],
         stakeholders_to_know: Stakeholder[],
         competitor_context: string,
         memory_sources: { episodic_count, semantic_count, procedural_count }
       }

GET    /deals/{deal_id}/report
       Response: {
         executive_summary: string,
         deal_health: "strong" | "at_risk" | "critical",
         risk_level: "low" | "medium" | "high" | "critical",
         patterns: Pattern[],
         winning_strategies: Strategy[],
         next_steps: string[],
         memory_timeline: MemoryEvent[]
       }

GET    /deals/{deal_id}/memory
       Response: {
         episodic: HindsightMemory[],
         semantic: HindsightMemory[],
         procedural: HindsightMemory[],
         total_count: number
       }

POST   /deals/{deal_id}/recommend
       Body: { context?: string }   (optional extra context for recommendations)
       Response: {
         recommendations: Recommendation[],
         confidence: "low" | "medium" | "high"
       }
```

---

### Health

```
GET    /health
       Response: {
         status: "ok",
         groq: "connected" | "error",
         supabase: "connected" | "error",
         hindsight: "connected" | "error"
       }
```

---

## Pydantic Models Reference

```python
# models/deal.py
class DealCreate(BaseModel):
    name: str
    company: str
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None
    deal_value: Optional[float] = None
    stage: str = "discovery"

class DealResponse(DealCreate):
    id: str
    hindsight_tags: List[str]
    meeting_count: int = 0
    created_at: datetime
    updated_at: datetime

# models/meeting.py
class ProcessingStatus(BaseModel):
    meeting_id: str
    status: str
    step_message: str
    error: Optional[str] = None

# models/intelligence.py
class Objection(BaseModel):
    text: str
    severity: str  # low | medium | high
    was_handled: bool = False

class Stakeholder(BaseModel):
    name: str
    role: str
    sentiment: str  # positive | neutral | skeptical | negative
    influence: str  # low | medium | high

class MeetingIntelligenceResponse(BaseModel):
    meeting_id: str
    objections: List[Objection]
    competitors: List[dict]
    stakeholders: List[Stakeholder]
    action_items: List[dict]
    budget_signals: List[dict]
    risks: List[dict]
    sentiment: str
    sentiment_score: float
```

---

# OUTPUT 7: SYSTEM DESIGN EXPLANATION

> Use this section when explaining your architecture in internship interviews.

## Architecture Pattern: Layered Monolith with Service Separation

This project intentionally avoids microservices. It follows a clean layered architecture:

**Layer 1 — Presentation Layer (Next.js)**
Handles all user interaction and rendering. Communicates only with the Application Layer via HTTP REST. Contains zero business logic.

**Layer 2 — Application Layer (FastAPI)**
The application layer is further split into:

- **API handlers** (`/api/`): Accept requests, validate input, call services, return responses. They contain no business logic.
- **Service layer** (`/services/`): All business logic lives here. Each service has a single responsibility:
  - `transcription.py` → STT only
  - `intelligence_extractor.py` → LLM extraction only
  - `memory_manager.py` → Hindsight read/write only
  - `pattern_detector.py` → Cross-meeting analysis only
  - `report_generator.py` → Output formatting only

**Layer 3 — Data/Memory Layer (Supabase + Hindsight)**
Two stores with distinct roles:

- **Supabase**: Stores structured, queryable data (deals, meetings, intelligence records).
- **Hindsight**: Stores unstructured, semantically searchable memory content.

## Async Processing Pipeline

The audio processing chain is inherently sequential but each step is slow. The design uses polling rather than WebSockets for simplicity:

```
Client → POST /upload → Server starts processing → Returns immediately with {status: "transcribing"}
Client → polls GET /status every 3 seconds
Server updates processing_status in Supabase after each step
Client shows progress steps: Transcribing... → Analyzing... → Updating Memory... → Complete
```

This pattern avoids WebSocket complexity while giving users live feedback.

## Why Supabase AND Hindsight?

A common interview question. The answer:

- **Supabase** is optimized for structured relational queries: "Give me all meetings for deal X" or "What is the sentiment score for meeting 3?"
- **Hindsight** is optimized for semantic retrieval: "What have I learned about objection handling across all my deals?" or "Recall everything relevant to this prospect's budget concerns."

They serve different access patterns. One is relational, one is vector-semantic. Using both is the correct architectural decision.

## Scalability Path (Interview Answer)

"For this hackathon, the processing pipeline runs synchronously in FastAPI. In a production system, each step (transcription, extraction, memory update) would be a separate worker connected via a message queue like Redis or SQS. The database schema and service separation are already designed to support this without architectural changes."

---

# OUTPUT 8: MASTER CONTEXT DOCUMENT (SUMMARY)

> **COPY THIS BLOCK INTO EVERY NEW CONVERSATION WITH ANTIGRAVITY OR CLAUDE.**

```
PROJECT: Deal Intelligence Agent
HACKATHON: Hindsight AI Agent Hackathon
GOAL: AI-powered sales copilot that extracts intelligence from meeting recordings
and builds persistent memory that improves after every meeting.

TECH STACK:
- Frontend: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- Backend: FastAPI (Python)
- Database: Supabase (PostgreSQL)
- Memory: Hindsight Cloud
- STT: Groq Whisper (whisper-large-v3)
- LLM: Groq (qwen/qwen3-32b, fallback: llama-3.3-70b-versatile)

ARCHITECTURE PATTERN: Layered monolith.
- API handlers → Service layer → Data layer
- Audio upload → Groq Whisper → Groq LLM extraction → Supabase + Hindsight

MEMORY DESIGN:
- Episodic: Per-meeting events stored in Hindsight after each meeting
- Semantic: Cross-meeting patterns, updated after each meeting (starts meeting 2)
- Procedural: Winning strategies, derived from patterns (starts meeting 3)
- All memories tagged with deal_id for retrieval

DATABASE TABLES:
- deals (id, name, company, contact_name, contact_role, deal_value, stage, hindsight_tags)
- meetings (id, deal_id, transcript, processing_status, meeting_number)
- meeting_intelligence (id, meeting_id, deal_id, objections, competitors, stakeholders,
  action_items, budget_signals, risks, sentiment, sentiment_score)
- deal_memory_summary (id, deal_id, recurring_objections, key_stakeholders,
  competitor_landscape, sentiment_trend, deal_risk_level, winning_strategies, total_meetings)

KEY RULES:
- All service business logic lives in backend/services/, NOT in api/ route handlers
- LLM prompts live centralized in backend/utils/prompts.py
- No microservices, no Kafka, no Redis, no Kubernetes
- Processing status uses polling, not WebSockets
- CORS enabled in FastAPI for localhost:3000

ENV VARIABLES:
Backend: GROQ_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
         HINDSIGHT_API_KEY, HINDSIGHT_PIPELINE_ID
Frontend: NEXT_PUBLIC_API_URL=http://localhost:8000

CURRENT PHASE: [UPDATE THIS EACH SESSION — Phase 1 / 2 / 3 / 4]
LAST COMPLETED: [UPDATE THIS — e.g., "Supabase tables created, FastAPI running"]
NEXT TASK: [UPDATE THIS — e.g., "Implement Groq Whisper transcription service"]
```

---

# OUTPUT 9: DEVELOPMENT ROADMAP

## Phase Overview

```
Phase 1: Foundation        (Est. 3–4 hours)
Phase 2: Core Pipeline     (Est. 4–5 hours)
Phase 3: Memory + Reports  (Est. 3–4 hours)
Phase 4: UI Polish + Demo  (Est. 2–3 hours)

Total: ~12–16 hours of focused work
```

---

## Phase 1: Foundation

**Goal:** Running backend + frontend with database connected. No AI yet.

- [ ] Create GitHub repository
- [ ] Set up backend: `pip install fastapi uvicorn supabase httpx python-multipart pydantic python-dotenv`
- [ ] Create `config.py` with Settings class
- [ ] Create Supabase tables via Antigravity MCP
- [ ] Create `db/client.py` (Supabase singleton)
- [ ] Create Pydantic models for Deal and Meeting
- [ ] Implement Deal CRUD endpoints (`/api/deals.py`)
- [ ] Implement Meeting creation endpoint
- [ ] Set up Next.js with Tailwind and shadcn/ui
- [ ] Create `lib/api.ts` with all fetch functions
- [ ] Create Deal Dashboard page (list + create)
- [ ] Create Deal Detail page (shows meetings)
- [ ] Test: Create a deal via UI → appears in Supabase → appears in UI

**Definition of Done for Phase 1:**
You can create a deal, see it in the dashboard, click into it, and see an empty meetings list. All data persists in Supabase.

---

## Phase 2: Core Pipeline

**Goal:** Record audio → transcript → intelligence → stored in Supabase.

- [ ] Create `services/transcription.py` (Groq Whisper)
- [ ] Create `services/intelligence_extractor.py` (Groq LLM, structured JSON output)
- [ ] Write extraction prompt in `utils/prompts.py`
- [ ] Create audio upload endpoint (`POST /meetings/{id}/upload`)
- [ ] Implement async processing pipeline in the upload endpoint
- [ ] Implement status polling endpoint (`GET /meetings/{id}/status`)
- [ ] Create `MeetingRecorder.tsx` frontend component (MediaRecorder API)
- [ ] Create `ProcessingStatus.tsx` polling component
- [ ] Create `TranscriptViewer.tsx`
- [ ] Create `IntelligenceReport.tsx` with all sub-components
- [ ] Test: Record 2-minute audio → submit → see transcript + intelligence

**Definition of Done for Phase 2:**
Recording audio and clicking "End Meeting" results in a visible intelligence report (objections, competitors, stakeholders, action items) within 30-60 seconds.

---

## Phase 3: Memory + Reports

**Goal:** Hindsight memory working, pre-meeting brief and report generated.

- [ ] Set up Hindsight account, get API key, pipeline ID
- [ ] Create `services/memory_manager.py` (Hindsight store/retrieve)
- [ ] Create `services/pattern_detector.py` (semantic + procedural memory logic)
- [ ] Connect memory update to end of processing pipeline
- [ ] Create `GET /deals/{id}/memory` endpoint
- [ ] Create `GET /deals/{id}/brief` endpoint
- [ ] Create `GET /deals/{id}/report` endpoint
- [ ] Create `MemoryTimeline.tsx` visualization component
- [ ] Create `PreMeetingBrief.tsx` full page
- [ ] Create `DealReport.tsx` full page
- [ ] Test: After 2 meetings, see semantic memory created. After 3, see procedural.

**Definition of Done for Phase 3:**
After processing 3 meetings for one deal, the Memory Timeline shows 5-6 memories across all three types. The Pre-Meeting Brief references past meetings and gives specific strategic advice.

---

## Phase 4: UI Polish + Demo Prep

**Goal:** Polished UI, seeded demo data, demo rehearsal.

- [ ] Run `scripts/seed_demo_data.py` to create "TechCorp - Enterprise Deal" with 4 pre-seeded meetings and full Hindsight memories
- [ ] Polish `MemoryTimeline.tsx` (visual progression, good colors)
- [ ] Polish `PreMeetingBrief.tsx` (clean layout, memory source citations)
- [ ] Polish `DealCard.tsx` (show risk level, meeting count, stage badge)
- [ ] Add loading states everywhere
- [ ] Add error states and fallbacks
- [ ] Add `GET /health` endpoint
- [ ] Write README.md
- [ ] Rehearse demo script (see Demo-Day Strategy section)
- [ ] Record backup demo video

**Definition of Done for Phase 4:**
Demo runs end-to-end without bugs. Pre-seeded TechCorp deal looks rich and impressive. Memory timeline clearly shows learning progression.

---

# OUTPUT 10: ANTIGRAVITY PROMPT #1 — PROJECT INITIALIZATION

```
CONTEXT:
I am building a "Deal Intelligence Agent" — an AI-powered sales copilot that extracts
structured intelligence from meeting recordings and builds persistent memory that improves
after every meeting. The project uses Next.js, FastAPI, Supabase, Groq, and Hindsight.

TASK:
Initialize the complete project structure.

PART A — Create the backend folder structure:

Create the following directories and empty files (just the files, no code yet):
  backend/
    main.py
    config.py
    requirements.txt
    api/__init__.py
    api/deals.py
    api/meetings.py
    api/intelligence.py
    services/__init__.py
    services/transcription.py
    services/intelligence_extractor.py
    services/memory_manager.py
    services/pattern_detector.py
    services/report_generator.py
    models/__init__.py
    models/deal.py
    models/meeting.py
    models/intelligence.py
    db/__init__.py
    db/client.py
    db/migrations/001_initial_schema.sql
    utils/__init__.py
    utils/prompts.py
    .env.example

PART B — Write requirements.txt with these exact packages:
  fastapi==0.115.0
  uvicorn[standard]==0.30.0
  supabase==2.7.0
  httpx==0.27.0
  python-multipart==0.0.9
  pydantic==2.8.0
  pydantic-settings==2.4.0
  python-dotenv==1.0.1

PART C — Write backend/config.py:
  Create a Settings class using pydantic_settings.BaseSettings.
  Fields:
    GROQ_API_KEY: str
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    HINDSIGHT_API_KEY: str
    HINDSIGHT_PIPELINE_ID: str
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
  Use model_config = SettingsConfigDict(env_file=".env", extra="ignore")
  Export a singleton: settings = Settings()

PART D — Write backend/main.py:
  Import FastAPI, CORSMiddleware, and the settings.
  Configure CORS to allow origins from settings.CORS_ORIGINS,
    allow_methods=["*"], allow_headers=["*"], allow_credentials=True.
  Add a GET /health endpoint that returns:
    {"status": "ok", "service": "deal-intelligence-agent"}
  Mount the routers from api/deals.py, api/meetings.py, and api/intelligence.py
    all under prefix="/api/v1".
  Add uvicorn.run at the bottom with if __name__ == "__main__".

PART E — Write backend/.env.example:
  GROQ_API_KEY=your_groq_api_key_here
  SUPABASE_URL=your_supabase_url_here
  SUPABASE_ANON_KEY=your_supabase_anon_key_here
  SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
  HINDSIGHT_API_KEY=your_hindsight_api_key_here
  HINDSIGHT_PIPELINE_ID=your_hindsight_pipeline_id_here

PART F — Write the Supabase schema SQL at db/migrations/001_initial_schema.sql:
  Include these four tables exactly:

  TABLE: deals
    id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
    name: VARCHAR(255) NOT NULL
    company: VARCHAR(255) NOT NULL
    contact_name: VARCHAR(255)
    contact_role: VARCHAR(255)
    deal_value: DECIMAL(12,2)
    currency: VARCHAR(3) DEFAULT 'USD'
    stage: VARCHAR(50) DEFAULT 'discovery'
    hindsight_tags: JSONB DEFAULT '[]'
    notes: TEXT
    created_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    updated_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

  TABLE: meetings
    id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
    deal_id: UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE
    title: VARCHAR(255)
    meeting_date: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    duration_seconds: INTEGER
    transcript: TEXT
    audio_url: TEXT
    processing_status: VARCHAR(50) DEFAULT 'pending'
    processing_error: TEXT
    meeting_number: INTEGER
    created_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    updated_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

  TABLE: meeting_intelligence
    id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
    meeting_id: UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE
    deal_id: UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE
    objections: JSONB DEFAULT '[]'
    competitors: JSONB DEFAULT '[]'
    stakeholders: JSONB DEFAULT '[]'
    action_items: JSONB DEFAULT '[]'
    budget_signals: JSONB DEFAULT '[]'
    risks: JSONB DEFAULT '[]'
    key_decisions: JSONB DEFAULT '[]'
    sentiment: VARCHAR(20)
    sentiment_score: DECIMAL(4,3)
    sentiment_reasoning: TEXT
    raw_extraction: JSONB
    created_at: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

  TABLE: deal_memory_summary
    id: UUID PRIMARY KEY DEFAULT gen_random_uuid()
    deal_id: UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE UNIQUE
    recurring_objections: JSONB DEFAULT '[]'
    key_stakeholders: JSONB DEFAULT '[]'
    competitor_landscape: JSONB DEFAULT '[]'
    sentiment_trend: VARCHAR(20) DEFAULT 'neutral'
    deal_risk_level: VARCHAR(20) DEFAULT 'medium'
    winning_strategies: JSONB DEFAULT '[]'
    missed_opportunities: JSONB DEFAULT '[]'
    total_meetings: INTEGER DEFAULT 0
    last_meeting_date: TIMESTAMP WITH TIME ZONE
    last_updated: TIMESTAMP WITH TIME ZONE DEFAULT NOW()

  Also add indexes:
    CREATE INDEX idx_meetings_deal_id ON meetings(deal_id);
    CREATE INDEX idx_mi_meeting_id ON meeting_intelligence(meeting_id);
    CREATE INDEX idx_mi_deal_id ON meeting_intelligence(deal_id);
    CREATE INDEX idx_dms_deal_id ON deal_memory_summary(deal_id);

PART G — Use the Supabase MCP to execute the SQL from 001_initial_schema.sql
  and create all four tables in my Supabase project.

IMPORTANT RULES:
- Do NOT write placeholder comments like "# TODO: implement this" — leave files empty if not yet implemented
- The main.py MUST start the server and include all routers
- All file paths are relative to a root folder called "deal-intelligence-agent/"
- After generating all files, confirm what was created
```

---

# OUTPUT 11: ANTIGRAVITY PROMPT #2 — BACKEND FOUNDATION

```
CONTEXT:
We are building a Deal Intelligence Agent. The project structure is already initialized.
The Supabase tables (deals, meetings, meeting_intelligence, deal_memory_summary) are created.
FastAPI is running with config.py and main.py complete.

CURRENT TASK: Implement the backend foundation — all Pydantic models, the Supabase
database client, and the full Deal CRUD API.

PART A — Write backend/db/client.py:
  Import supabase and settings.
  Create a function get_supabase_client() that returns a supabase.Client.
  Use settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY (NOT anon key).
  Export a module-level variable: supabase = get_supabase_client()

PART B — Write backend/models/deal.py with these exact Pydantic classes:

  class DealCreate(BaseModel):
    name: str
    company: str
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None
    deal_value: Optional[float] = None
    currency: str = "USD"
    stage: str = "discovery"
    notes: Optional[str] = None

  class DealUpdate(BaseModel):
    All fields from DealCreate but all Optional

  class DealResponse(BaseModel):
    id: str
    name: str
    company: str
    contact_name: Optional[str]
    contact_role: Optional[str]
    deal_value: Optional[float]
    currency: str
    stage: str
    hindsight_tags: List[str]
    notes: Optional[str]
    total_meetings: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

PART C — Write backend/models/meeting.py with these exact Pydantic classes:

  class MeetingCreate(BaseModel):
    deal_id: str
    title: Optional[str] = None
    meeting_date: Optional[datetime] = None

  class MeetingResponse(BaseModel):
    id: str
    deal_id: str
    title: Optional[str]
    meeting_date: datetime
    duration_seconds: Optional[int]
    transcript: Optional[str]
    processing_status: str
    processing_error: Optional[str]
    meeting_number: Optional[int]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

  class ProcessingStatusResponse(BaseModel):
    meeting_id: str
    status: str
    step_message: str
    error: Optional[str] = None

PART D — Write backend/api/deals.py:
  Import APIRouter, supabase client, and Pydantic models.
  Create router = APIRouter(prefix="/deals", tags=["deals"])

  Endpoints:
    GET  /  → query Supabase deals table, also get meeting count for each deal
              from meetings table, return List[DealResponse]
    POST /  → insert into deals table, auto-generate hindsight_tags as
              ["deal:{id}", "company:{company.lower().replace(' ', '_')}"],
              then update the record with those tags, return DealResponse
    GET  /{deal_id} → get deal by id, include meeting count, return DealResponse
    PUT  /{deal_id} → update deal fields that are not None, return DealResponse
    DELETE /{deal_id} → delete deal, return {"success": True, "id": deal_id}

  For all Supabase errors: raise HTTPException(status_code=500, detail=str(e))
  For not found: raise HTTPException(status_code=404, detail="Deal not found")

PART E — Write backend/api/meetings.py:
  Import APIRouter, supabase client, and Pydantic models.
  Create router = APIRouter(tags=["meetings"])

  Endpoints:
    POST /deals/{deal_id}/meetings
      Body: MeetingCreate
      Steps:
        1. Verify deal exists (raise 404 if not)
        2. Count existing meetings for this deal (meeting_number = count + 1)
        3. Insert into meetings table with processing_status="pending"
        4. Return MeetingResponse

    GET /deals/{deal_id}/meetings
      Query all meetings for deal_id ordered by meeting_number ASC
      Return List[MeetingResponse]

    GET /meetings/{meeting_id}
      Get meeting by id. Return MeetingResponse.

    GET /meetings/{meeting_id}/status
      Query meetings table for processing_status.
      Map status to human-readable step_message:
        "pending" → "Waiting to start"
        "transcribing" → "Converting speech to text..."
        "extracting" → "Extracting sales intelligence..."
        "storing_memory" → "Updating deal memory..."
        "complete" → "Analysis complete"
        "failed" → "Processing failed"
      Return ProcessingStatusResponse.

  NOTE: The POST /meetings/{meeting_id}/upload endpoint will be added in Prompt #5.
  Leave a TODO comment for it in this file.

PART F — Update backend/main.py:
  Import the deals router and meetings router.
  Mount deals_router with prefix="/api/v1"
  Mount meetings_router with prefix="/api/v1"

IMPORTANT RULES:
- Use try/except around ALL Supabase calls
- The Supabase client uses the SERVICE ROLE KEY (bypasses RLS)
- Do NOT use async with Supabase-py v2 (it is synchronous)
- Return proper HTTP status codes (201 for create, 200 for get/update, 204 or 200 for delete)
- All IDs are UUIDs stored as strings
- Test every endpoint works before marking complete
```

---

# OUTPUT 12: ANTIGRAVITY PROMPT #3 — FRONTEND FOUNDATION

```
CONTEXT:
We are building a Deal Intelligence Agent.
Backend is running on http://localhost:8000
Deal CRUD API endpoints are working.

CURRENT TASK: Build the complete frontend foundation.
This includes the dashboard, deal creation, and deal detail pages.
NO audio recording or intelligence display yet — just deals and meetings.

PART A — Initialize Next.js project:
  In the "frontend" directory:
    npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir
  Then install shadcn/ui:
    npx shadcn@latest init (choose default style, zinc base color, CSS variables yes)
  Install these shadcn components:
    npx shadcn@latest add button card dialog input label badge toast progress
    npx shadcn@latest add select textarea separator skeleton

PART B — Write frontend/lib/types.ts with these interfaces:

  interface Deal {
    id: string;
    name: string;
    company: string;
    contact_name?: string;
    contact_role?: string;
    deal_value?: number;
    currency: string;
    stage: "discovery" | "qualification" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
    hindsight_tags: string[];
    notes?: string;
    total_meetings: number;
    created_at: string;
    updated_at: string;
  }

  interface Meeting {
    id: string;
    deal_id: string;
    title?: string;
    meeting_date: string;
    duration_seconds?: number;
    transcript?: string;
    processing_status: "pending" | "transcribing" | "extracting" | "storing_memory" | "complete" | "failed";
    processing_error?: string;
    meeting_number?: number;
    created_at: string;
  }

  interface ProcessingStatus {
    meeting_id: string;
    status: string;
    step_message: string;
    error?: string;
  }

PART C — Write frontend/lib/api.ts:
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  Export these typed async functions:
    getDeals(): Promise<Deal[]>
    getDeal(dealId: string): Promise<Deal>
    createDeal(data: Partial<Deal>): Promise<Deal>
    updateDeal(dealId: string, data: Partial<Deal>): Promise<Deal>
    deleteDeal(dealId: string): Promise<void>
    getMeetings(dealId: string): Promise<Meeting[]>
    getMeeting(meetingId: string): Promise<Meeting>
    createMeeting(dealId: string, data: {title?: string}): Promise<Meeting>
    getMeetingStatus(meetingId: string): Promise<ProcessingStatus>

  Each function should handle errors with: throw new Error(await res.text())

PART D — Create these components:

  components/deals/DealCard.tsx
    Props: { deal: Deal; onClick: () => void }
    Display:
      - Company name (large, bold)
      - Deal name (subtitle)
      - Stage badge (color-coded: discovery=gray, proposal=blue, negotiation=yellow,
        closed_won=green, closed_lost=red)
      - Deal value formatted as currency (e.g. "$120,000")
      - Meeting count ("4 meetings")
      - Clicking the card calls onClick

  components/deals/CreateDealModal.tsx
    Props: { onCreated: (deal: Deal) => void }
    Shows a button "New Deal" that opens a Dialog.
    Form fields: Name (required), Company (required), Contact Name,
      Contact Role, Deal Value (number), Stage (select dropdown)
    On submit: calls createDeal() API, calls onCreated with result, closes dialog.
    Show loading state on submit button.

  components/meetings/MeetingCard.tsx
    Props: { meeting: Meeting; dealId: string }
    Display:
      - Meeting title or "Meeting #{meeting_number}"
      - Meeting date formatted
      - Processing status badge
      - If status is "complete": link to /deals/{dealId}/meeting/{meetingId}

PART E — Create these pages:

  app/page.tsx (Dashboard)
    Title: "Deal Intelligence Agent"
    Subtitle: "Your AI-powered sales memory"
    Fetch and display all deals using DealCard components in a grid layout.
    Include CreateDealModal.
    Clicking a DealCard navigates to /deals/{dealId}.
    Show skeleton loaders while loading.

  app/deals/[dealId]/page.tsx (Deal Detail)
    Header: Deal name + company + stage badge
    Two sections:
      Left: List of meetings using MeetingCard components.
            Add a "New Meeting" button that calls createMeeting() API.
      Right: A placeholder panel titled "Deal Memory" with text:
             "Memory will appear here after your first meeting."
    Fetch deal and meetings from API on load.

PART F — Create frontend/.env.local:
  NEXT_PUBLIC_API_URL=http://localhost:8000

IMPORTANT RULES:
- Use 'use client' at the top of all components and pages that use state or effects
- All API calls go through lib/api.ts — never fetch directly in components
- Use shadcn/ui components for ALL UI elements (no custom buttons or inputs)
- Show loading and error states everywhere
- No inline styles — use Tailwind classes only
- All pages use the App Router (app/ directory), NOT pages/
```

---

# OUTPUT 13: ANTIGRAVITY PROMPT #4 — HINDSIGHT INTEGRATION

```
CONTEXT:
We are building a Deal Intelligence Agent.
Backend (FastAPI) and Frontend (Next.js) are running.
Supabase tables exist and deal CRUD works.
We now need to integrate Hindsight memory.

CURRENT TASK: Build the complete Hindsight memory service.

BACKGROUND ON HINDSIGHT:
Hindsight is a memory system with a REST API.
Base URL: https://api.hindsight.vectorize.io (verify against docs)
We store memories using POST requests and retrieve using search/query endpoints.
Each memory has: content (string), metadata (dict).
We filter memories using metadata fields.

IMPORTANT: Before writing any code, check the Hindsight Python SDK documentation
at https://hindsight.vectorize.io/sdks/python and use the correct method names
from the actual SDK. If the SDK is not available, use the REST API directly with httpx.

PART A — Install Hindsight SDK:
  Add to requirements.txt and install: the official Hindsight Python package.
  If no Python SDK exists, we will use httpx REST calls directly.

PART B — Write backend/services/memory_manager.py:

  This service handles ALL Hindsight operations.

  Class: HindsightMemoryManager

  Constructor:
    self.api_key = settings.HINDSIGHT_API_KEY
    self.pipeline_id = settings.HINDSIGHT_PIPELINE_ID
    self.base_url = "https://api.hindsight.vectorize.io"  # verify this URL

  Method: async store_episodic_memory(deal_id, meeting_id, meeting_number, content_dict)
    content_dict has: company, events, objections, competitors, stakeholders, sentiment
    Format content as a human-readable string:
      "Meeting #{meeting_number} with {company} ({date}).
       Key events: {events}
       Objections raised: {objections}
       Competitors mentioned: {competitors}
       Stakeholders: {stakeholders}
       Meeting sentiment: {sentiment}"
    Store in Hindsight with metadata:
      {"deal_id": deal_id, "meeting_id": meeting_id, "memory_type": "episodic",
       "meeting_number": meeting_number, "company": company}
    Return the created memory's ID.

  Method: async store_semantic_memory(deal_id, company, patterns_dict)
    patterns_dict has: pricing_pattern, stakeholder_pattern, competitor_pattern,
                       sentiment_trend
    Format as human-readable string describing cross-meeting patterns.
    Store with metadata:
      {"deal_id": deal_id, "memory_type": "semantic", "company": company,
       "updated_after_meeting": patterns_dict.meeting_number}
    First check if a semantic memory for this deal_id already exists.
    If yes: UPDATE it (replace content). If no: CREATE new.
    Return memory ID.

  Method: async store_procedural_memory(deal_id, company, strategies_dict)
    strategies_dict has: what_works, what_doesnt_work, recommended_next_steps
    Format as human-readable strategy guide.
    Store with metadata:
      {"deal_id": deal_id, "memory_type": "procedural", "company": company}
    First check if procedural memory for this deal_id already exists.
    If yes: UPDATE. If no: CREATE.
    Return memory ID.

  Method: async get_all_deal_memories(deal_id) -> dict
    Query Hindsight for all memories where metadata.deal_id == deal_id.
    Separate results by memory_type.
    Return:
      {
        "episodic": [list of episodic memory objects],
        "semantic": [list of semantic memory objects],
        "procedural": [list of procedural memory objects],
        "total_count": total
      }

  Method: async search_deal_memories(deal_id, query) -> list
    Semantic search on Hindsight with:
      - query string
      - filter by deal_id metadata
    Return list of relevant memory objects.

PART C — Write backend/services/pattern_detector.py:

  This service analyzes multiple meeting_intelligence records and derives patterns.
  It is called AFTER each new meeting is processed.
  It calls HindsightMemoryManager to store the derived memories.

  Function: async detect_and_store_patterns(deal_id: str, supabase_client)
    Steps:
    1. Fetch all meeting_intelligence records for this deal_id from Supabase,
       ordered by meeting creation date.
    2. If total meetings < 2: only store episodic, skip pattern detection.
    3. Build a summary of all intelligence across all meetings.
    4. Send to Groq LLM with the PATTERN_DETECTION_PROMPT from utils/prompts.py.
    5. Parse LLM response as JSON.
    6. If meetings >= 2: call memory_manager.store_semantic_memory()
    7. If meetings >= 3: call memory_manager.store_procedural_memory()
    8. Update deal_memory_summary table in Supabase with the derived patterns.

PART D — Write the pattern detection prompt in backend/utils/prompts.py:

  PATTERN_DETECTION_PROMPT:
    You are analyzing {meeting_count} meetings for a sales deal with {company}.

    Meeting intelligence data:
    {meeting_data}

    Identify patterns across these meetings. Return ONLY a JSON object with no
    preamble, no markdown, no backticks. The JSON must have exactly these fields:

    {{
      "pricing_pattern": "string describing pricing objection frequency and nature, or null",
      "stakeholder_pattern": "string describing key decision makers and their influence",
      "competitor_pattern": "string describing competitor mentions and competitive dynamics",
      "sentiment_trend": "improving | declining | stable | volatile",
      "what_works": ["list", "of", "strategies", "that", "worked"],
      "what_doesnt_work": ["list", "of", "approaches", "to", "avoid"],
      "recommended_next_steps": ["list", "of", "specific", "tactical", "recommendations"],
      "deal_risk_level": "low | medium | high | critical",
      "deal_risk_reasoning": "one sentence explaining risk level"
    }}

PART E — Write backend/api/intelligence.py:

  Router prefix: "" (no prefix, routes added to /api/v1 base)
  Tags: ["intelligence"]

  GET /deals/{deal_id}/memory
    Call memory_manager.get_all_deal_memories(deal_id)
    Return the result directly.

  GET /deals/{deal_id}/brief
    1. Get deal from Supabase (raise 404 if not found)
    2. Call memory_manager.get_all_deal_memories(deal_id)
    3. Build a context string from all memories
    4. Send to Groq LLM with BRIEF_GENERATION_PROMPT from utils/prompts.py
    5. Parse and return the brief as JSON

  GET /deals/{deal_id}/report
    1. Get deal and all meeting_intelligence from Supabase
    2. Get all memories from Hindsight
    3. Get deal_memory_summary from Supabase
    4. Send all data to Groq LLM with REPORT_GENERATION_PROMPT
    5. Return structured report JSON

PART F — Add BRIEF_GENERATION_PROMPT and REPORT_GENERATION_PROMPT to utils/prompts.py:

  BRIEF_GENERATION_PROMPT:
    You are a sales intelligence assistant. A sales rep is about to go into a meeting
    with {company}. Based on the memory context below, generate a pre-meeting brief.

    Memory context:
    {memory_context}

    Return ONLY a JSON object with no preamble, no markdown, no backticks:
    {{
      "deal_context": "2-3 sentence summary of deal history and current state",
      "meeting_history_summary": "brief summary of all past meetings",
      "recurring_risks": [
        {{"risk": "string", "severity": "low|medium|high", "appeared_in_meetings": [1,2]}}
      ],
      "recommended_strategies": [
        {{"strategy": "string", "reasoning": "why this works for this deal"}}
      ],
      "stakeholders_to_know": [
        {{"name": "string", "role": "string", "key_concern": "string"}}
      ],
      "competitor_context": "string about competitive dynamics",
      "confidence": "low|medium|high (based on how many meetings worth of data)"
    }}

IMPORTANT RULES:
- The memory_manager MUST handle Hindsight API errors gracefully (catch exceptions,
  log them, do not crash the processing pipeline)
- If Hindsight is unavailable, the system should still store data in Supabase
  and continue functioning
- All Groq LLM calls must strip markdown fences before JSON.parse
- Validate that LLM responses are valid JSON before using them
```

---

# OUTPUT 14: ANTIGRAVITY PROMPT #5 — RECOMMENDATION ENGINE (CORE PIPELINE)

````
CONTEXT:
We are building a Deal Intelligence Agent.
Hindsight memory service is implemented.
Intelligence prompts are written.
We now need the complete audio processing pipeline — the heart of the product.

CURRENT TASK: Implement the audio upload endpoint and the complete processing pipeline.

PART A — Write backend/services/transcription.py:

  Function: async transcribe_audio(audio_bytes: bytes, filename: str) -> str
    Use httpx.AsyncClient to POST to:
      https://api.groq.com/openai/v1/audio/transcriptions
    Headers: {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
    Body: multipart/form-data with:
      files={"file": (filename, audio_bytes, "audio/webm")}
      data={"model": "whisper-large-v3", "response_format": "text"}
    Timeout: 120 seconds
    Error handling:
      - If response status >= 400: raise ValueError with the response text
      - Log audio size before sending
    Return: response.text (the transcript string)

PART B — Write the intelligence extraction prompt in backend/utils/prompts.py:

  INTELLIGENCE_EXTRACTION_PROMPT:
    You are analyzing a sales meeting transcript. Extract structured intelligence.

    Transcript:
    {transcript}

    Return ONLY a JSON object. No preamble, no markdown backticks, no explanation.

    {{
      "objections": [
        {{"text": "exact objection raised", "severity": "low|medium|high", "was_handled": true|false}}
      ],
      "competitors": [
        {{"name": "competitor name", "context": "how they were mentioned"}}
      ],
      "stakeholders": [
        {{"name": "person name or Unknown", "role": "their role",
          "sentiment": "positive|neutral|skeptical|negative", "influence": "low|medium|high"}}
      ],
      "action_items": [
        {{"item": "what needs to be done", "owner": "us|prospect|both",
          "deadline": "timeframe mentioned or null"}}
      ],
      "budget_signals": [
        {{"signal": "exact budget-related statement or indicator", "type": "positive|negative|neutral"}}
      ],
      "risks": [
        {{"risk": "description of the risk", "severity": "low|medium|high"}}
      ],
      "key_decisions": [
        {{"decision": "what was decided"}}
      ],
      "sentiment": "positive|neutral|negative|mixed",
      "sentiment_score": 0.0,
      "sentiment_reasoning": "one sentence explanation"
    }}

    Rules:
    - If something was not mentioned, return an empty array []
    - sentiment_score is a float between -1.0 (very negative) and +1.0 (very positive)
    - Extract ALL objections, even minor ones
    - If a person's name is unknown, use "Unknown Participant"

PART C — Write backend/services/intelligence_extractor.py:

  Function: async extract_intelligence(transcript: str) -> dict
    Build the prompt using INTELLIGENCE_EXTRACTION_PROMPT with transcript inserted.
    Call Groq API:
      POST https://api.groq.com/openai/v1/chat/completions
      Headers: {"Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json"}
      Body:
        {"model": "qwen/qwen3-32b",
         "messages": [{"role": "user", "content": prompt}],
         "max_tokens": 2000,
         "temperature": 0.1}
    Parse response:
      content = response_json["choices"][0]["message"]["content"]
      Strip markdown: remove ```json, ```, and strip whitespace
      Parse as JSON with json.loads()
    If json.loads fails: retry with model "llama-3.3-70b-versatile" (one retry only)
    Return parsed dict.
    On error: return a safe empty dict with all fields as empty arrays.

PART D — Complete the processing pipeline in backend/api/meetings.py:

  ADD this endpoint:

  POST /meetings/{meeting_id}/upload
    This endpoint accepts a multipart audio file and runs the processing pipeline.

    Steps (IN ORDER, update processing_status in Supabase after each step):

    Step 0: Verify meeting exists. Set status to "transcribing".

    Step 1 — Transcription:
      Read uploaded file as bytes.
      Call transcription.transcribe_audio(audio_bytes, filename).
      Save transcript to meetings table.
      Set status to "extracting".

    Step 2 — Intelligence Extraction:
      Call intelligence_extractor.extract_intelligence(transcript).
      Save raw_extraction to meeting_intelligence table (INSERT new row).
      Also save all structured fields (objections, competitors, etc.)
      Save sentiment and sentiment_score.
      Set status to "storing_memory".

    Step 3 — Memory Storage:
      Build episodic content dict from extracted intelligence.
      Call memory_manager.store_episodic_memory(deal_id, meeting_id, ...).
      Call pattern_detector.detect_and_store_patterns(deal_id).
      Set status to "complete".

    If ANY step fails:
      Set processing_status to "failed".
      Set processing_error to the error message.
      Do NOT crash — return 200 with {"status": "failed", "error": message}.

    Return: {"meeting_id": id, "status": "processing_started"}

    The endpoint returns immediately after starting processing.
    Use FastAPI's BackgroundTasks to run the pipeline asynchronously:
      background_tasks.add_task(run_processing_pipeline, meeting_id, audio_bytes, filename)

    The run_processing_pipeline function handles all 3 steps above.

PART E — Add meeting intelligence endpoint to backend/api/meetings.py:

  GET /meetings/{meeting_id}/intelligence
    Query meeting_intelligence table for this meeting_id.
    If not found or meeting status != "complete": raise 404.
    Return all intelligence fields as JSON.
    Also include: meeting number, meeting date, deal_id.

PART F — Update the frontend to handle audio recording:

  Write components/meetings/MeetingRecorder.tsx:
    Props: { dealId: string; onMeetingComplete: (meetingId: string) => void }

    State:
      isRecording: boolean
      meetingId: string | null (set when recording starts)
      processingStatus: ProcessingStatus | null
      isPolling: boolean

    "Start Meeting" button:
      1. Call createMeeting(dealId, {title: "Meeting " + date})
      2. Store meetingId
      3. Start MediaRecorder: navigator.mediaDevices.getUserMedia({audio: true})
      4. Use MediaRecorder with mimeType "audio/webm"
      5. Collect audio chunks in an array
      6. Show recording timer (seconds elapsed)

    "End Meeting" button (visible during recording):
      1. Stop MediaRecorder
      2. Create Blob from chunks: new Blob(chunks, {type: "audio/webm"})
      3. Create FormData with blob as "audio" field
      4. POST to /api/v1/meetings/{meetingId}/upload
      5. Set isPolling = true

    Polling (when isPolling = true):
      Every 3 seconds call getMeetingStatus(meetingId).
      Update processingStatus state.
      Show ProcessingStatus component.
      When status = "complete": stop polling, call onMeetingComplete(meetingId).
      When status = "failed": stop polling, show error.

    Show the recording timer as a red pulsing dot + MM:SS counter.

  Write components/meetings/ProcessingStatus.tsx:
    Props: { status: ProcessingStatus }
    Display the step_message with a spinner if status is not complete or failed.
    Show checkmarks for completed steps (transcribing → extracting → storing_memory → complete).
    Use shadcn Progress component to show pipeline progress (25% → 50% → 75% → 100%).

IMPORTANT RULES:
- The BackgroundTasks approach means the upload endpoint returns immediately —
  this is correct, do not change it to synchronous
- Always update processing_status in Supabase BEFORE starting each step (not after)
  so that if the step fails, the status shows which step failed
- The frontend must handle the case where getUserMedia permission is denied
  (show a clear error message)
- Audio blobs sent as FormData field name must be exactly "audio" (matching the
  FastAPI parameter name)
- Strip ALL markdown from LLM responses before JSON.parse — models often add ```json
````

---

# OUTPUT 15: ANTIGRAVITY PROMPT #6 — UI + MEMORY VISUALIZATION

```
CONTEXT:
We are building a Deal Intelligence Agent.
The full pipeline works: record → transcript → intelligence → Hindsight memory.
We now need the final UI layer: Intelligence Report display, Memory Timeline,
and the Pre-Meeting Brief page.

CURRENT TASK: Build all intelligence display components and the memory visualization.

PART A — Write components/intelligence/IntelligenceReport.tsx:

  Props: { meetingId: string; dealId: string }

  Fetch intelligence from GET /api/v1/meetings/{meetingId}/intelligence on load.

  Layout: Two-column grid on desktop, single column on mobile.

  Sections (each as a separate component):

    1. Sentiment Header:
       Large sentiment badge (green=positive, yellow=mixed, red=negative)
       Sentiment score displayed as a progress bar
       Sentiment reasoning in italic text

    2. ObjectionsList:
       Each objection as a card with:
         - Objection text
         - Severity badge (red=high, yellow=medium, gray=low)
         - "Handled" or "Unresolved" badge

    3. StakeholderGrid:
       Each stakeholder as a card with:
         - Name and role
         - Sentiment icon (😊 positive, 😐 neutral, 🤨 skeptical, 😟 negative)
         - Influence badge

    4. CompetitorTags:
       Each competitor as a colored chip with context in tooltip

    5. ActionItemsList:
       Each action item as a checkbox row (visual only, not interactive)
       Owner tag: "Our team" | "Prospect" | "Both"

    6. RiskIndicator:
       Risk cards with severity-colored left border
       High severity risks highlighted in red

PART B — Write components/memory/MemoryTimeline.tsx (THE KEY DEMO COMPONENT):

  Props: { dealId: string }

  Fetch from GET /api/v1/deals/{dealId}/memory on load.

  Display a visual timeline showing how memory has evolved:

  Header: "What the Agent Has Learned" with a brain icon

  Section 1 — Episodic Memories (labeled "Meeting Records"):
    Show one card per episodic memory, in meeting order.
    Each card: Meeting #N, date, 2-3 line summary preview.
    Color: Indigo/purple
    Icon: 📋 or similar

  Section 2 — Semantic Memories (labeled "Patterns Discovered"):
    Show the semantic memory card if it exists.
    Highlight key patterns as bullet points.
    Color: Blue
    Icon: 🔍 or similar
    Show badge: "Emerged after Meeting 2" or similar

  Section 3 — Procedural Memories (labeled "Winning Strategies"):
    Show the procedural memory card if it exists.
    Show what_works and what_doesnt_work as two columns.
    Color: Green
    Icon: ⭐ or similar
    Show badge: "Derived after Meeting 3" or similar

  If fewer than 2 meetings: Show a gentle message:
    "More patterns will emerge as you log more meetings."

  At the bottom: Show total memory count and a message:
    "The agent has {N} memories of this deal and gets smarter with every meeting."

PART C — Write app/deals/[dealId]/memory/page.tsx:
  Title: "Memory Timeline — {dealName}"
  Include MemoryTimeline component.
  Back button to deal page.

PART D — Write components/brief/PreMeetingBrief.tsx:

  Props: { dealId: string; dealName: string; company: string }

  Fetch from GET /api/v1/deals/{dealId}/brief on load.

  Layout:

    Header card:
      "Pre-Meeting Brief" title
      "{company}" subtitle
      Confidence badge (low=gray, medium=yellow, high=green)
      Note: "Based on {N} meetings of accumulated memory"

    Section: Deal Context
      Brief paragraph summary of deal history

    Section: ⚠️ Risks to Watch
      For each risk: colored card with severity indicator
      Sources: "Appeared in meetings #1, #3"

    Section: 👥 Key Stakeholders
      Cards for each stakeholder: name, role, key concern

    Section: 🏆 Recommended Strategies
      For each strategy: card with strategy + reasoning

    Section: 🎯 Competitor Context
      Brief paragraph about competitive dynamics

  Loading state: Skeleton layout while fetching.
  Error state: "Brief unavailable — process at least one meeting to generate context."

PART E — Write app/deals/[dealId]/brief/page.tsx:
  Fetch deal from API.
  Render PreMeetingBrief component.
  Include back button.

PART F — Update app/deals/[dealId]/page.tsx:
  Add two prominent buttons to the deal detail page:
    "📋 Get Pre-Meeting Brief" → navigates to /deals/{dealId}/brief
    "🧠 View Memory Timeline" → navigates to /deals/{dealId}/memory

  Replace the placeholder "Deal Memory" panel with:
    A summary from deal_memory_summary:
      - Deal risk level badge
      - Sentiment trend
      - Meeting count
      - Top 3 recurring objections (truncated)
    If no meetings yet: show the placeholder.

PART G — Write scripts/seed_demo_data.py (Python script):

  This script creates REALISTIC demo data for presentation day.

  Create one deal:
    name="Enterprise Platform Deal"
    company="TechCorp Solutions"
    contact_name="Michael Torres"
    contact_role="VP of Engineering"
    deal_value=120000
    stage="negotiation"

  Create 4 meeting intelligence records with realistic data:

  Meeting 1 (2 weeks ago) — "Initial Discovery Call":
    objections: [{"text": "We're not sure this integrates with our stack", "severity": "medium"}]
    competitors: []
    stakeholders: [{"name": "Michael Torres", "role": "VP Engineering", "sentiment": "positive", "influence": "high"}]
    sentiment: "positive", sentiment_score: 0.65

  Meeting 2 (10 days ago) — "Technical Deep Dive":
    objections: [{"text": "The enterprise pricing seems high for our current budget", "severity": "high"}]
    competitors: [{"name": "Salesforce", "context": "We currently use Salesforce and considering if switching makes sense"}]
    stakeholders: [
      {"name": "Michael Torres", "role": "VP Engineering", "sentiment": "neutral", "influence": "high"},
      {"name": "Sarah Chen", "role": "CFO", "sentiment": "skeptical", "influence": "high"}
    ]
    sentiment: "mixed", sentiment_score: 0.1

  Meeting 3 (5 days ago) — "Pricing and ROI Review":
    objections: [
      {"text": "Your price is 40% over what we budgeted", "severity": "high"},
      {"text": "Implementation timeline feels too long", "severity": "medium"}
    ]
    competitors: [
      {"name": "Salesforce", "context": "Their migration cost from Salesforce is a concern"},
      {"name": "HubSpot", "context": "Prospect mentioned HubSpot as alternative"}
    ]
    stakeholders: [
      {"name": "Sarah Chen", "role": "CFO", "sentiment": "skeptical", "influence": "high"},
      {"name": "Michael Torres", "role": "VP Engineering", "sentiment": "positive", "influence": "medium"}
    ]
    action_items: [{"item": "Send phased pricing proposal", "owner": "us", "deadline": "end of week"}]
    sentiment: "mixed", sentiment_score: -0.1

  Meeting 4 (yesterday) — "ROI Presentation":
    objections: [{"text": "We need legal to review the contract terms", "severity": "low"}]
    competitors: [{"name": "Salesforce", "context": "Addressed migration cost comparison directly"}]
    stakeholders: [
      {"name": "Sarah Chen", "role": "CFO", "sentiment": "neutral", "influence": "high"},
      {"name": "Michael Torres", "role": "VP Engineering", "sentiment": "positive", "influence": "high"},
      {"name": "James Liu", "role": "Legal Counsel", "sentiment": "neutral", "influence": "medium"}
    ]
    action_items: [
      {"item": "Legal to review contract", "owner": "both", "deadline": "next week"},
      {"item": "Send final phased pricing deck", "owner": "us", "deadline": "tomorrow"}
    ]
    sentiment: "positive", sentiment_score: 0.55

  After inserting all meetings, call the pattern detection service to generate
  and store all three types of Hindsight memories for this deal.

  Print progress as each step completes.
  Print the deal_id at the end so it can be used in the demo.

IMPORTANT RULES:
- The MemoryTimeline component is the #1 most important visual in the demo — make it beautiful
- Use shadcn Card components for all memory cards
- Memory cards should have clear color coding (indigo/blue/green for E/S/P memory types)
- The Pre-Meeting Brief page should look professional enough to screenshot for LinkedIn
- The seed script must be runnable standalone: python scripts/seed_demo_data.py
- All dates in seed data should be relative (today - N days), not hardcoded dates
```

---

# OUTPUT 16: DEMO-DAY STRATEGY

## The 60-Second Demo Story

> Practice this until you can say it without thinking.

```
"Imagine you're a sales rep at [your company]. You've had four meetings with TechCorp,
and you have meeting five in 10 minutes.

Without this tool, you'd be frantically scrolling through CRM notes, trying to remember
what Sarah the CFO's main concern was, whether you sent that pricing deck, and whether
they mentioned Salesforce in meeting two or three.

With Deal Intelligence Agent, you just click Get Pre-Meeting Brief."

[Click Get Pre-Meeting Brief]

"The agent has read all four meetings and pulled out exactly what matters:
Sarah Chen, the CFO, is the financial gatekeeper. Pricing has been raised three times.
Salesforce is the competitor you need to address head-on.
And the system recommends leading with the phased pricing model.

That brief took 2 seconds and would have taken me 20 minutes.

Now watch what happens when I record a new meeting."

[Start recording, speak for 30 seconds: "Sarah, I understand your Q1 budget
concern. Here's the phased approach: $40K this quarter, $80K in Q3..."]

[End meeting, show processing steps]

"Transcribing... analyzing... updating memory..."

[Show new intelligence report]

"Now let me show you the Memory Timeline."

[Click Memory Timeline]

"After meeting 1, the agent had one memory. Meeting 2, it detected a pricing
pattern and stored that. Meeting 3, it had enough data to start generating strategy.
And now, after meeting 5, look — it knows this deal better than most CRMs.

This isn't just a recording tool. It's a sales memory that compounds over time."
```

## Pre-Demo Checklist (Night Before)

- [ ] Run `python scripts/seed_demo_data.py` — confirm 4 meetings seeded
- [ ] Open the app, click "Get Pre-Meeting Brief" — verify it loads correctly
- [ ] Click "View Memory Timeline" — verify all three memory types visible
- [ ] Test a 30-second recording end-to-end — confirm pipeline completes in <60s
- [ ] Test on the presentation laptop/browser (not just your dev machine)
- [ ] Confirm Groq API key works (run the test in Postman or curl)
- [ ] Confirm Hindsight API key works
- [ ] Have the app running and deal dashboard open BEFORE presenting
- [ ] Disable browser notifications and alerts
- [ ] Record a 3-minute backup video of the full demo flow

## Fallback Plans

**If live transcription fails:**
Pre-record a meeting where you know Groq Whisper worked. Have the processed meeting_intelligence already saved. Demo the output, not the processing.

**If Hindsight is down:**
Switch to showing the Supabase data as the "memory" — deal_memory_summary has all the same patterns. The story is identical.

**If the whole app crashes:**
Open your backup video. Say: "Let me show you the recorded demo — I'll talk you through it."

## Demo Data Details

The TechCorp deal should show clearly:

- 4 meetings over 2 weeks (looks like real deal velocity)
- $120,000 ARR (believable enterprise deal size)
- Pricing objection: appears in 3 of 4 meetings (75% recurrence = strong pattern)
- CFO Sarah Chen: skeptical buyer who needs careful handling
- Salesforce: incumbent competitor mentioned in meetings 2, 3, and 4
- Sentiment trend: declining meeting 2→3, recovering meeting 3→4 (interesting story arc)

---

# OUTPUT 17: DEBUGGING STRATEGY

## When Something Breaks — Systematic Approach

### Layer 1: Always Check First

```bash
# 1. Is the backend running?
curl http://localhost:8000/health

# 2. Is the DB connected? (check Supabase dashboard → Table Editor)

# 3. Are env vars loaded?
# In backend/main.py temporarily add:
# print(settings.GROQ_API_KEY[:10])  # print first 10 chars
```

### Layer 2: Test Each Service in Isolation

**Test Groq Whisper:**

```python
# Run this in a Python shell
import httpx, asyncio
async def test():
    with open("test_audio.webm", "rb") as f:
        audio = f.read()
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": "Bearer YOUR_GROQ_KEY"},
            files={"file": ("test.webm", audio, "audio/webm")},
            data={"model": "whisper-large-v3", "response_format": "text"},
            timeout=60.0
        )
        print(r.status_code, r.text[:200])
asyncio.run(test())
```

**Test Groq LLM:**

```python
import httpx, asyncio
async def test():
    async with httpx.AsyncClient() as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": "Bearer YOUR_GROQ_KEY",
                     "Content-Type": "application/json"},
            json={"model": "qwen/qwen3-32b",
                  "messages": [{"role": "user", "content": "Say hello as JSON: {\"message\": \"hello\"}"}],
                  "max_tokens": 100},
            timeout=30.0
        )
        print(r.status_code, r.json())
asyncio.run(test())
```

### Layer 3: Processing Pipeline Debugging

When audio upload returns but status stays at "transcribing":

1. Add print statements at start of every step in `run_processing_pipeline`
2. Check Supabase meetings table: what is the processing_status value?
3. Check processing_error column — it will show the exception

When intelligence extraction returns empty arrays:

1. Print the raw LLM response BEFORE JSON.parse
2. Check if model returned markdown fences (`json ... `)
3. Try with llama-3.3-70b-versatile as fallback model

When Hindsight memory fails:

1. Check API key and pipeline ID are correct
2. Print full HTTP response from Hindsight
3. If Hindsight is failing, comment out memory storage temporarily to unblock pipeline

### Layer 4: Frontend Debugging

```typescript
// Add to lib/api.ts temporarily:
async function fetchWithLog(url: string, options?: RequestInit) {
  console.log("API CALL:", url, options);
  const res = await fetch(url, options);
  console.log("API RESPONSE:", res.status);
  return res;
}
```

**CORS errors:**
Add `http://localhost:3000` to CORS_ORIGINS in config.py. Check that FastAPI is running on port 8000 and frontend on 3000.

**Audio recording fails:**
Browser requires HTTPS or localhost for getUserMedia. Never use a non-localhost IP for development.

### Layer 5: The Nuclear Option

If you're stuck for >30 minutes on one bug:

1. Document the bug exactly
2. Paste the error + relevant code into a new Claude session with the Master Context block
3. Ask: "This specific error is happening: [error]. The relevant code is: [code]. What is wrong?"
4. Do NOT ask Antigravity to guess — be specific

---

# OUTPUT 18: CONTEXT MAINTENANCE ACROSS TOOLS

## The Problem

Claude, Antigravity, and ChatGPT all have zero memory between sessions. Every session starts fresh. If you don't provide context, you'll get generic, conflicting advice that breaks your existing code.

## The Solution: Always Open With the Context Block

At the start of EVERY session with EVERY tool, paste this block (update the last 3 lines):

```
PROJECT: Deal Intelligence Agent
HACKATHON: Hindsight AI Agent Hackathon

STACK: Next.js 14 + FastAPI + Supabase + Hindsight + Groq
ARCHITECTURE: Layered monolith. API handlers → Service layer → Data layer.
Audio upload → Groq Whisper → Groq LLM extraction → Supabase + Hindsight memory.

THREE MEMORY TYPES in Hindsight: episodic (per-meeting), semantic (cross-meeting patterns),
procedural (winning strategies). All tagged with deal_id metadata.

BACKEND STRUCTURE:
  api/ → thin route handlers only
  services/ → ALL business logic (transcription, extraction, memory, patterns, reports)
  models/ → Pydantic schemas
  utils/prompts.py → ALL LLM prompts live here

ENV VARS: GROQ_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
          HINDSIGHT_API_KEY, HINDSIGHT_PIPELINE_ID, NEXT_PUBLIC_API_URL

RULES: No microservices. No Redis. No Kafka. Service separation is mandatory.
Processing pipeline uses async BackgroundTasks + polling (no WebSockets).

CURRENT PHASE: [PHASE 1 / 2 / 3 / 4 — update this]
LAST COMPLETED: [e.g., "Supabase tables created, deal CRUD working, Next.js running"]
CURRENT TASK: [e.g., "Implementing Groq Whisper transcription service"]
SPECIFIC PROBLEM: [e.g., "Getting a 422 error on audio upload endpoint"]
```

## Tool Assignments

| Task                                     | Best Tool         |
| ---------------------------------------- | ----------------- |
| Architecture decisions, design review    | Claude            |
| Writing new service files and components | Antigravity       |
| Debugging complex errors                 | Claude            |
| Writing Pydantic models and schemas      | Antigravity       |
| Writing LLM prompts                      | Claude            |
| Building React components                | Antigravity       |
| Database schema review                   | Claude            |
| Running migrations via MCP               | Antigravity       |
| Interview prep / explaining the system   | Claude            |
| Seed data generation                     | ChatGPT or Claude |

## Git Strategy

Commit after each Phase completes:

```bash
git commit -m "Phase 1: Foundation — DB tables, Deal CRUD, Next.js dashboard"
git commit -m "Phase 2: Core pipeline — Groq Whisper + LLM extraction working"
git commit -m "Phase 3: Hindsight memory — all 3 types stored and retrieved"
git commit -m "Phase 4: UI polish + demo data seeded"
```

Never commit `.env`. Always commit `.env.example`.

## Context Recovery Procedure

If you lose track of where you are:

1. Run `git log --oneline -10` — see last 10 commits
2. Run `curl http://localhost:8000/health` — see what's running
3. Open Supabase Table Editor — see what tables exist and have data
4. Open Hindsight Cloud dashboard — see what memories have been stored
5. Update the "LAST COMPLETED" line in your context block

---

# OUTPUT 19: RISK REGISTER

Ranked by: **Impact × Probability**. Address in order.

| #   | Risk                                                            | Probability | Impact | Mitigation                                                                                                            |
| --- | --------------------------------------------------------------- | ----------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Groq LLM returns invalid JSON (model fails to follow format)    | HIGH        | HIGH   | Add JSON stripping, retry with fallback model, return empty dict on final failure                                     |
| 2   | Audio file too large for Groq Whisper (>25MB)                   | MEDIUM      | HIGH   | Compress audio in browser; demo recordings should be <5 min                                                           |
| 3   | Hindsight API downtime on demo day                              | MEDIUM      | HIGH   | Build graceful fallback: show Supabase deal_memory_summary data instead                                               |
| 4   | CORS errors blocking frontend-backend communication             | HIGH        | MEDIUM | Add localhost:3000 to CORS origins explicitly; test from the start                                                    |
| 5   | MediaRecorder not supported in demo browser                     | MEDIUM      | HIGH   | Test in Chrome (best support). Have pre-recorded audio file as fallback                                               |
| 6   | Hindsight API documentation differs from assumptions            | HIGH        | MEDIUM | Read docs carefully before Prompt #4. Adjust method names before coding                                               |
| 7   | qwen/qwen3-32b model not available on Groq                      | MEDIUM      | MEDIUM | Always have llama-3.3-70b-versatile as fallback in code                                                               |
| 8   | Supabase connection timeout under load                          | LOW         | HIGH   | Use service role key; add connection error handling everywhere                                                        |
| 9   | Pattern detection prompt produces nonsense after only 1 meeting | MEDIUM      | MEDIUM | Gate pattern detection: skip semantic if meetings < 2, skip procedural if meetings < 3                                |
| 10  | Processing pipeline hangs (BackgroundTask silently fails)       | MEDIUM      | HIGH   | Add explicit try/except in pipeline, always write to processing_status and processing_error                           |
| 11  | Demo laptop has no microphone or mic blocked                    | MEDIUM      | HIGH   | Test mic permissions the night before. Have pre-recorded file ready                                                   |
| 12  | Frontend hot-reload resets recording mid-demo                   | LOW         | HIGH   | Never hot-reload during recording. Disable fast-refresh for demo                                                      |
| 13  | Seed data looks fake/unconvincing to judges                     | MEDIUM      | MEDIUM | Use realistic names, dollar amounts, specific objection language. Review before demo                                  |
| 14  | Memory Timeline component not visually impressive               | MEDIUM      | HIGH   | Spend dedicated time on this component. It's 25% of judging criteria made visible                                     |
| 15  | Rate limiting on Groq API during live demo                      | LOW         | MEDIUM | Check rate limits. Keep a Groq "backup API key" from a second account                                                 |
| 16  | Supabase MCP connection fails during development                | MEDIUM      | LOW    | Know how to run SQL manually in Supabase Dashboard as fallback                                                        |
| 17  | Demo video not recorded before presentation                     | MEDIUM      | HIGH   | Record video at end of Phase 4. Upload to YouTube unlisted. Have URL ready                                            |
| 18  | Complexity of 3-memory-type system confuses judge explanation   | LOW         | HIGH   | Prepare a simple 3-sentence explanation: "Episodic is what happened. Semantic is patterns. Procedural is what to do." |
| 19  | Backend crashes if transcript is empty (empty audio)            | MEDIUM      | LOW    | Check transcript length before extraction. Return error if < 50 characters                                            |
| 20  | GitHub repo is messy on submission day                          | LOW         | MEDIUM | Clean commit history, write README.md, remove .env files, add demo video link                                         |

---

# OUTPUT 20: FINAL CTO CRITIQUE

## What This Architecture Gets Right

**1. The memory story is clear and visible.** The three-memory-type framework (Episodic → Semantic → Procedural) is more than a technical pattern — it's a demo narrative. Judges see memory being born, growing, and improving. That's exactly what 25% of your score is looking for.

**2. The tech stack is boring in the best way.** Next.js + FastAPI + Supabase is the fastest path to a working demo. You didn't pick Go for the backend or introduce Kubernetes. Good.

**3. Groq for everything is correct.** One API key, best-in-class speed, zero local setup. Using Groq for both STT and LLM is the right call for a hackathon.

**4. Service separation is the right level of engineering.** You will comfortably explain this in interviews: "I separated transcription, intelligence extraction, memory management, and pattern detection into distinct service classes." That answer earns respect.

---

## What the Brief Got Wrong (Honest Assessment)

**1. The processing pipeline is described as synchronous, but it needs to be async from day one.**
The brief implies you can "just process audio inline." You cannot. Groq Whisper + LLM extraction + Hindsight storage takes 20–60 seconds minimum. BackgroundTasks + polling is the right pattern. I've baked this into Prompt #5.

**2. "Three memory types" risks sounding academic without clear visual payoff.**
Judges who don't know the terminology won't care unless they SEE it. The MemoryTimeline component in Prompt #6 is the most important thing you'll build. Do not skip or rush it.

**3. The brief underestimates the importance of seed data.**
A system with 0 meetings is a system with nothing to show. The seed data script is NOT optional. It's what makes the demo look mature and intelligent rather than a prototype. Run it before every demo rehearsal.

---

## What Will Win vs. What Will Lose

**Will WIN:**

- Walking judges through the Pre-Meeting Brief and saying "this brief references meeting #2 and #3 specifically" — because it shows REAL memory retrieval, not a cached summary
- The Memory Timeline showing learning progression (Meeting 1: 1 memory. Meeting 4: 6 memories.)
- Smooth, rehearsed 60-second story with no hesitation
- Code that actually runs without crashes

**Will LOSE:**

- Showing a transcript viewer as the "main feature"
- Claiming memory without showing the Hindsight retrieval clearly
- Buggy live demo with no video fallback
- Scope creep: multi-deal analytics, user auth, email integrations — none of this matters for the hackathon

---

## The One Thing You Must Not Get Wrong

The brief you receive from the demo should feel **unnervingly specific**.

Not: "The prospect has raised pricing concerns."

But: "Sarah Chen, the CFO who joined in Meeting 3, has now raised the enterprise pricing tier as a blocker in 3 of your 4 meetings. She's the financial gatekeeper and her skepticism is the #1 risk to this deal closing."

That level of specificity comes from Hindsight actually storing and retrieving structured memories. Build the intelligence extraction prompt carefully. That's what wins.

---

## Final Prioritization

If you run out of time, ship in this order:

1. ✅ Working audio → transcript → intelligence extraction → Supabase
2. ✅ Hindsight memory stored and retrieved
3. ✅ Pre-Meeting Brief page (even if ugly)
4. ✅ Memory Timeline (even if simple)
5. ✅ Seed data loaded
6. ⬜ Polish and animations
7. ⬜ Mobile responsiveness
8. ⬜ Edge case handling

A working, seeded, memory-powered demo that tells a clear story beats a polished, animated app that has no real memory.

**Ship the memory. Win the hackathon.**

---

## Hindsight API Setup (Action Items Before Coding)

1. Go to https://ui.hindsight.vectorize.io
2. Create an account
3. Go to Billing → Enter promo code `MEMHACK6` for $50 credits
4. Create a new Pipeline named "deal-intelligence-agent"
5. Copy Pipeline ID → add to `.env` as `HINDSIGHT_PIPELINE_ID`
6. Generate API Key → add to `.env` as `HINDSIGHT_API_KEY`
7. Read the Python SDK docs at https://hindsight.vectorize.io/sdks/python
8. Note the exact method names for store, search, and update
9. Update Prompt #4 if method names differ from what's assumed

Do this BEFORE starting Phase 3. Discovering the SDK is wrong at 2am will cost hours.

---

_Document version: 2.0 | Last updated: [Update this when you make changes]_
_This document is the single source of truth for the project._
_Every coding session should begin with the Master Context block from Output 8._
