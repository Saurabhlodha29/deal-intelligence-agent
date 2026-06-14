INTELLIGENCE_EXTRACTION_PROMPT = """You are analyzing a sales meeting transcript. Extract structured intelligence.

Transcript:
{transcript}

Return ONLY a JSON object. No preamble, no markdown backticks, no explanation.

{{
  "objections": [
    {"text": "exact objection raised", "severity": "low|medium|high", "was_handled": true|false}
  ],
  "competitors": [
    {"name": "competitor name", "context": "how they were mentioned"}
  ],
  "stakeholders": [
    {"name": "person name or Unknown", "role": "their role",
     "sentiment": "positive|neutral|skeptical|negative", "influence": "low|medium|high"}
  ],
  "action_items": [
    {"item": "what needs to be done", "owner": "us|prospect|both",
     "deadline": "timeframe mentioned or null"}
  ],
  "budget_signals": [
    {"signal": "exact budget-related statement or indicator", "type": "positive|negative|neutral"}
  ],
  "risks": [
    {"risk": "description of the risk", "severity": "low|medium|high"}
  ],
  "key_decisions": [
    {"decision": "what was decided"}
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
"""


PATTERN_DETECTION_PROMPT = """You are analyzing {meeting_count} sales meetings with {company}.

Meeting intelligence data:
{meeting_data}

Identify patterns across these meetings. Return ONLY a valid JSON object.
No preamble, no markdown backticks, no explanation before or after.

{{
  "pricing_pattern": "string describing pricing objection frequency and nature, or null if not applicable",
  "stakeholder_pattern": "string describing key decision makers, their roles and influence level",
  "competitor_pattern": "string describing competitor mentions and competitive dynamics, or null",
  "sentiment_trend": "improving",
  "deal_risk_level": "medium",
  "deal_risk_reasoning": "one sentence explaining the risk level",
  "what_works": ["strategy that produced positive response", "another effective approach"],
  "what_doesnt_work": ["approach that caused disengagement", "another ineffective tactic"],
  "recommended_next_steps": ["specific tactic for next meeting", "another concrete recommendation"]
}}

For sentiment_trend use exactly one of: improving, declining, stable, volatile
For deal_risk_level use exactly one of: low, medium, high, critical
"""


BRIEF_GENERATION_PROMPT = """You are a sales intelligence assistant. A sales rep is about to meet with {company}.
Based on the memory context below, generate a concise pre-meeting brief.

Memory context:
{memory_context}

Return ONLY a valid JSON object. No preamble, no markdown, no explanation.

{{
  "deal_context": "2-3 sentence summary of the deal history and current state",
  "meeting_history_summary": "brief summary of all past meetings and their outcomes",
  "recurring_risks": [
    {{"risk": "description of the risk", "severity": "high", "appeared_in_meetings": [1, 2]}}
  ],
  "recommended_strategies": [
    {{"strategy": "specific tactic to use", "reasoning": "why this works for this deal"}}
  ],
  "stakeholders_to_know": [
    {{"name": "person name", "role": "their role", "key_concern": "what they care most about"}}
  ],
  "competitor_context": "brief description of competitive dynamics and how to handle them",
  "confidence": "medium"
}}

For confidence use exactly one of: low (1 meeting), medium (2-3 meetings), high (4+ meetings)
For severity use exactly one of: low, medium, high
"""
