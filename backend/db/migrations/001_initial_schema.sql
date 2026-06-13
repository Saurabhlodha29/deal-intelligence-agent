-- TABLE: deals
CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    contact_role VARCHAR(255),
    deal_value DECIMAL(12,2),
    currency VARCHAR(3) DEFAULT 'USD',
    stage VARCHAR(50) DEFAULT 'discovery',
    hindsight_tags JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLE: meetings
CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    title VARCHAR(255),
    meeting_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duration_seconds INTEGER,
    transcript TEXT,
    audio_url TEXT,
    processing_status VARCHAR(50) DEFAULT 'pending',
    processing_error TEXT,
    meeting_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLE: meeting_intelligence
CREATE TABLE meeting_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    objections JSONB DEFAULT '[]',
    competitors JSONB DEFAULT '[]',
    stakeholders JSONB DEFAULT '[]',
    action_items JSONB DEFAULT '[]',
    budget_signals JSONB DEFAULT '[]',
    risks JSONB DEFAULT '[]',
    key_decisions JSONB DEFAULT '[]',
    sentiment VARCHAR(20),
    sentiment_score DECIMAL(4,3),
    sentiment_reasoning TEXT,
    raw_extraction JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLE: deal_memory_summary
CREATE TABLE deal_memory_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE UNIQUE,
    recurring_objections JSONB DEFAULT '[]',
    key_stakeholders JSONB DEFAULT '[]',
    competitor_landscape JSONB DEFAULT '[]',
    sentiment_trend VARCHAR(20) DEFAULT 'neutral',
    deal_risk_level VARCHAR(20) DEFAULT 'medium',
    winning_strategies JSONB DEFAULT '[]',
    missed_opportunities JSONB DEFAULT '[]',
    total_meetings INTEGER DEFAULT 0,
    last_meeting_date TIMESTAMP WITH TIME ZONE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_meetings_deal_id ON meetings(deal_id);
CREATE INDEX idx_mi_meeting_id ON meeting_intelligence(meeting_id);
CREATE INDEX idx_mi_deal_id ON meeting_intelligence(deal_id);
CREATE INDEX idx_dms_deal_id ON deal_memory_summary(deal_id);
