from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class MeetingCreate(BaseModel):
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
