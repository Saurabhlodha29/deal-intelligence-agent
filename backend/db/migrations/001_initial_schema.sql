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
    -- pending -> transcribing -> extracting -> storing_memory -> complete | failed
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
