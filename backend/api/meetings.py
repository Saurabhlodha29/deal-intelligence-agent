from typing import List
from fastapi import APIRouter, HTTPException, status
from db.client import supabase
from models.meeting import MeetingCreate, MeetingResponse, ProcessingStatusResponse

router = APIRouter(tags=["meetings"])

@router.post("/deals/{deal_id}/meetings", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
def create_meeting(deal_id: str, meeting: MeetingCreate):
    try:
        # 1. Verify deal exists
        deal_res = supabase.table("deals").select("id").eq("id", deal_id).execute()
        if not deal_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deal not found"
            )

        # 2. Count existing meetings for this deal
        meetings_res = supabase.table("meetings").select("id").eq("deal_id", deal_id).execute()
        meeting_number = len(meetings_res.data) + 1

        # 3. Insert into meetings table with processing_status="pending"
        meeting_data = meeting.model_dump(exclude_unset=True)
        meeting_data["deal_id"] = deal_id
        meeting_data["meeting_number"] = meeting_number
        meeting_data["processing_status"] = "pending"

        res = supabase.table("meetings").insert(meeting_data).execute()
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create meeting record"
            )

        return MeetingResponse(**res.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/deals/{deal_id}/meetings", response_model=List[MeetingResponse])
def list_meetings(deal_id: str):
    try:
        # Verify deal exists
        deal_res = supabase.table("deals").select("id").eq("id", deal_id).execute()
        if not deal_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deal not found"
            )

        # Query meetings ordered by meeting_number ASC
        res = supabase.table("meetings").select("*").eq("deal_id", deal_id).order("meeting_number", desc=False).execute()
        return [MeetingResponse(**m) for m in res.data]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/meetings/{meeting_id}", response_model=MeetingResponse)
def get_meeting(meeting_id: str):
    try:
        res = supabase.table("meetings").select("*").eq("id", meeting_id).execute()
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
        return MeetingResponse(**res.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/meetings/{meeting_id}/status", response_model=ProcessingStatusResponse)
def get_meeting_status(meeting_id: str):
    try:
        res = supabase.table("meetings").select("processing_status", "processing_error").eq("id", meeting_id).execute()
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
        
        status_val = res.data[0]["processing_status"]
        error_val = res.data[0]["processing_error"]

        status_map = {
            "pending": "Waiting to start",
            "transcribing": "Converting speech to text...",
            "extracting": "Extracting sales intelligence...",
            "storing_memory": "Updating deal memory...",
            "complete": "Analysis complete",
            "failed": "Processing failed"
        }
        step_message = status_map.get(status_val, "Unknown status")

        return ProcessingStatusResponse(
            meeting_id=meeting_id,
            status=status_val,
            step_message=step_message,
            error=error_val
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# TODO: Add POST /meetings/{meeting_id}/upload endpoint here in Prompt #5.
