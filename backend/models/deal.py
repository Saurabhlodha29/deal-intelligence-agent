from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

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
    name: Optional[str] = None
    company: Optional[str] = None
    contact_name: Optional[str] = None
    contact_role: Optional[str] = None
    deal_value: Optional[float] = None
    currency: Optional[str] = None
    stage: Optional[str] = None
    notes: Optional[str] = None

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
