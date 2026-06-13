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
