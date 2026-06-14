INTELLIGENCE_EXTRACTION_PROMPT = """You are analyzing a sales meeting transcript. Extract structured intelligence.

Transcript:
{transcript}

Return ONLY a valid JSON object with double quotes. No preamble, no markdown backticks, no explanation.

The JSON must have this exact structure:
{{
  "objections": [
    {{"text": "exact objection raised", "severity": "low", "was_handled": false}}
  ],
  "competitors": [
    {{"name": "competitor name", "context": "how they were mentioned"}}
  ],
  "stakeholders": [
    {{"name": "person name or Unknown", "role": "their role",
     "sentiment": "positive", "influence": "low"}}
  ],
  "action_items": [
    {{"item": "what needs to be done", "owner": "us",
     "deadline": null}}
  ],
  "budget_signals": [
    {{"signal": "exact budget-related statement or indicator", "type": "positive"}}
  ],
  "risks": [
    {{"risk": "description of the risk", "severity": "low"}}
  ],
  "key_decisions": [
    {{"decision": "what was decided"}}
  ],
  "sentiment": "positive",
  "sentiment_score": 0.0,
  "sentiment_reasoning": "one sentence explanation"
}}

Rules:
- If something was not mentioned, return an empty array []
- sentiment_score is a float between -1.0 (very negative) and +1.0 (very positive)
- Extract ALL objections, even minor ones
- If a person's name is unknown, use "Unknown Participant"
- severity values must be exactly: low, medium, or high
- sentiment values must be exactly: positive, neutral, negative, or mixed
"""


PATTERN_DETECTION_PROMPT = """You are analyzing {meeting_count} sales meetings with {company}.

Meeting intelligence data:
{meeting_data}

Identify patterns across these meetings. Return ONLY a valid JSON object.
No preamble, no markdown backticks, no explanation before or after.

{{
  "pricing_pattern": "string describing pricing objection frequency and nature",
  "stakeholder_pattern": "string describing key decision makers, their roles and influence level",
  "competitor_pattern": "string describing competitor mentions and competitive dynamics",
  "sentiment_trend": "improving",
  "deal_risk_level": "medium",
  "deal_risk_reasoning": "one sentence explaining the risk level",
  "what_works": ["strategy that produced positive response"],
  "what_doesnt_work": ["approach that caused disengagement"],
  "recommended_next_steps": ["specific tactic for next meeting"]
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


REPORT_GENERATION_PROMPT = """You are a sales intelligence analyst. Generate a comprehensive deal report.

Deal and memory context:
{memory_context}

Return ONLY a valid JSON object. No preamble, no markdown, no explanation.

{{
  "executive_summary": "2-3 sentence summary of the deal status and key findings",
  "deal_health": "strong",
  "risk_level": "medium",
  "patterns": [
    {{"pattern": "description of the pattern", "type": "pricing|stakeholder|competitor|sentiment", "frequency": "high"}}
  ],
  "winning_strategies": [
    {{"strategy": "what's working", "evidence": "specific example from meetings"}}
  ],
  "next_steps": [
    "specific actionable recommendation for the next meeting"
  ],
  "memory_timeline": [
    {{"meeting_number": 1, "event": "brief description of what happened", "type": "episodic|semantic|procedural"}}
  ]
}}

For deal_health use exactly one of: strong, at_risk, critical
For risk_level use exactly one of: low, medium, high, critical
"""


RECOMMENDATION_PROMPT = """You are a sales strategy advisor. Based on the deal history below, provide specific recommendations for the next meeting.

Deal and memory context:
{memory_context}

Return ONLY a valid JSON object. No preamble, no markdown, no explanation.

{{
  "recommendations": [
    {{"title": "recommendation title", "description": "detailed explanation", "priority": "high", "category": "strategy|objection_handling|stakeholder_engagement|competitive"}}
  ],
  "confidence": "medium"
}}

For priority use exactly one of: low, medium, high
For confidence use exactly one of: low, medium, high
For category use exactly one of: strategy, objection_handling, stakeholder_engagement, competitive
"""
