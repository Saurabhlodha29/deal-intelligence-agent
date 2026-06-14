from typing import List, Optional
from pydantic import BaseModel


class Objection(BaseModel):
    text: str
    severity: str  # low | medium | high
    was_handled: bool = False


class Competitor(BaseModel):
    name: str
    context: str


class Stakeholder(BaseModel):
    name: str
    role: str
    sentiment: str  # positive | neutral | skeptical | negative
    influence: str  # low | medium | high


class ActionItem(BaseModel):
    item: str
    owner: str  # us | prospect | both
    deadline: Optional[str] = None


class BudgetSignal(BaseModel):
    signal: str
    type: str  # positive | negative | neutral


class Risk(BaseModel):
    risk: str
    severity: str  # low | medium | high


class KeyDecision(BaseModel):
    decision: str


class MeetingIntelligenceResponse(BaseModel):
    meeting_id: str
    objections: List[Objection] = []
    competitors: List[Competitor] = []
    stakeholders: List[Stakeholder] = []
    action_items: List[ActionItem] = []
    budget_signals: List[BudgetSignal] = []
    risks: List[Risk] = []
    key_decisions: List[KeyDecision] = []
    sentiment: str = "neutral"
    sentiment_score: float = 0.0
    sentiment_reasoning: str = ""


class BriefResponse(BaseModel):
    deal_context: str = ""
    meeting_history_summary: str = ""
    recurring_risks: List[dict] = []
    recommended_strategies: List[dict] = []
    stakeholders_to_know: List[dict] = []
    competitor_context: str = ""
    confidence: str = "low"
    memory_sources: dict = {}


class ReportResponse(BaseModel):
    executive_summary: str = ""
    deal_health: str = "at_risk"
    risk_level: str = "medium"
    patterns: List[dict] = []
    winning_strategies: List[dict] = []
    next_steps: List[str] = []
    memory_timeline: List[dict] = []


class RecommendationResponse(BaseModel):
    recommendations: List[dict] = []
    confidence: str = "low"


class MemoryResponse(BaseModel):
    episodic: List[dict] = []
    semantic: List[dict] = []
    procedural: List[dict] = []
    total_count: int = 0
