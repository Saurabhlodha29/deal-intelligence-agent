from typing import List
from fastapi import APIRouter, HTTPException, status, BackgroundTasks, UploadFile, File
from db.client import supabase
from models.meeting import MeetingCreate, MeetingResponse, ProcessingStatusResponse
from services.transcription import transcribe_audio
from services.intelligence_extractor import extract_intelligence
from services.memory_manager import store_episodic_memory
from services.pattern_detector import detect_and_store_patterns

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

async def run_processing_pipeline(meeting_id: str, audio_bytes: bytes, filename: str):
    """
    Background task: runs the complete audio processing pipeline.
    Each step updates processing_status in Supabase before starting.
    On any failure, sets status to 'failed' with the error message.
    """
    def set_status(s: str, error: str = None):
        update = {"processing_status": s}
        if error:
            update["processing_error"] = error[:500]
        supabase.table("meetings").update(update).eq("id", meeting_id).execute()

    try:
        # Get deal_id for this meeting
        meeting_res = supabase.table("meetings").select("deal_id, meeting_number").eq("id", meeting_id).execute()
        if not meeting_res.data:
            return
        deal_id = meeting_res.data[0]["deal_id"]
        meeting_number = meeting_res.data[0].get("meeting_number", 1)

        # Get company name
        deal_res = supabase.table("deals").select("company").eq("id", deal_id).execute()
        company = deal_res.data[0]["company"] if deal_res.data else "Unknown Company"

        # STEP 1: Transcription
        set_status("transcribing")
        try:
            transcript = await transcribe_audio(audio_bytes, filename)
            if not transcript or len(transcript.strip()) < 10:
                raise ValueError("Transcript is too short or empty")
            supabase.table("meetings").update({"transcript": transcript}).eq("id", meeting_id).execute()
        except Exception as e:
            set_status("failed", f"Transcription error: {str(e)}")
            return

        # STEP 2: Intelligence Extraction
        set_status("extracting")
        try:
            intelligence = await extract_intelligence(transcript)
            if not intelligence or not isinstance(intelligence, dict):
                raise ValueError("Extraction returned empty or invalid result")
        except Exception as e:
            set_status("failed", f"Intelligence extraction failed: {str(e)[:200]}")
            return

        # Save intelligence to Supabase
        try:
            intelligence_record = {
                "meeting_id": meeting_id,
                "deal_id": deal_id,
                "objections": intelligence.get("objections", []),
                "competitors": intelligence.get("competitors", []),
                "stakeholders": intelligence.get("stakeholders", []),
                "action_items": intelligence.get("action_items", []),
                "budget_signals": intelligence.get("budget_signals", []),
                "risks": intelligence.get("risks", []),
                "key_decisions": intelligence.get("key_decisions", []),
                "sentiment": intelligence.get("sentiment", "neutral"),
                "sentiment_score": float(intelligence.get("sentiment_score", 0.0)),
                "sentiment_reasoning": intelligence.get("sentiment_reasoning", ""),
                "raw_extraction": intelligence,
            }
            supabase.table("meeting_intelligence").insert(intelligence_record).execute()
        except Exception as e:
            # Log but don't fail — proceed to memory storage
            import logging
            logging.getLogger(__name__).error(f"Failed to save intelligence to Supabase: {e}")

        # STEP 3: Memory Storage
        set_status("storing_memory")
        try:
            await store_episodic_memory(
                deal_id=deal_id,
                meeting_id=meeting_id,
                meeting_number=meeting_number,
                company=company,
                intelligence=intelligence,
            )
            await detect_and_store_patterns(deal_id=deal_id, supabase=supabase)
        except Exception as e:
            # Memory failure should NOT fail the whole pipeline
            import logging
            logging.getLogger(__name__).error(f"Memory storage failed (non-fatal): {e}")

        # DONE
        set_status("complete")

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Pipeline crashed for meeting {meeting_id}: {e}")
        set_status("failed", str(e))


async def run_extraction_only(meeting_id: str, transcript: str):
    """
    Background task: runs only intelligence extraction and memory storage.
    Used for retrying failed extractions.
    """
    def set_status(s: str, error: str = None):
        update = {"processing_status": s}
        if error:
            update["processing_error"] = error[:500]
        supabase.table("meetings").update(update).eq("id", meeting_id).execute()

    try:
        # Get deal_id for this meeting
        meeting_res = supabase.table("meetings").select("deal_id, meeting_number").eq("id", meeting_id).execute()
        if not meeting_res.data:
            return
        deal_id = meeting_res.data[0]["deal_id"]
        meeting_number = meeting_res.data[0].get("meeting_number", 1)

        # Get company name
        deal_res = supabase.table("deals").select("company").eq("id", deal_id).execute()
        company = deal_res.data[0]["company"] if deal_res.data else "Unknown Company"

        # STEP 1: Intelligence Extraction
        set_status("extracting")
        try:
            intelligence = await extract_intelligence(transcript)
            if not intelligence or not isinstance(intelligence, dict):
                raise ValueError("Extraction returned empty or invalid result")
        except Exception as e:
            set_status("failed", f"Intelligence extraction failed: {str(e)[:200]}")
            return

        # Save intelligence to Supabase
        try:
            intelligence_record = {
                "meeting_id": meeting_id,
                "deal_id": deal_id,
                "objections": intelligence.get("objections", []),
                "competitors": intelligence.get("competitors", []),
                "stakeholders": intelligence.get("stakeholders", []),
                "action_items": intelligence.get("action_items", []),
                "budget_signals": intelligence.get("budget_signals", []),
                "risks": intelligence.get("risks", []),
                "key_decisions": intelligence.get("key_decisions", []),
                "sentiment": intelligence.get("sentiment", "neutral"),
                "sentiment_score": float(intelligence.get("sentiment_score", 0.0)),
                "sentiment_reasoning": intelligence.get("sentiment_reasoning", ""),
                "raw_extraction": intelligence,
            }
            supabase.table("meeting_intelligence").insert(intelligence_record).execute()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to save intelligence to Supabase: {e}")

        # STEP 2: Memory Storage
        set_status("storing_memory")
        try:
            await store_episodic_memory(
                deal_id=deal_id,
                meeting_id=meeting_id,
                meeting_number=meeting_number,
                company=company,
                intelligence=intelligence,
            )
            await detect_and_store_patterns(deal_id=deal_id, supabase=supabase)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Memory storage failed (non-fatal): {e}")

        # DONE
        set_status("complete")

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Extraction retry crashed for meeting {meeting_id}: {e}")
        set_status("failed", str(e))


@router.post("/meetings/{meeting_id}/upload")
async def upload_meeting_audio(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
):
    """
    Accept audio file upload, start background processing pipeline.
    Returns immediately. Poll /meetings/{meeting_id}/status for progress.
    """
    try:
        # Verify meeting exists
        res = supabase.table("meetings").select("id, processing_status").eq("id", meeting_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Meeting not found")

        # Read audio bytes
        audio_bytes = await audio.read()
        if len(audio_bytes) == 0:
            raise HTTPException(status_code=400, detail="Audio file is empty")

        filename = audio.filename or f"meeting_{meeting_id}.webm"

        # Store audio in Supabase Storage
        audio_path = f"{meeting_id}/{filename}"
        try:
            supabase.storage.from_("meeting-audio").upload(
                path=audio_path,
                file=audio_bytes,
                file_options={"content-type": "audio/webm"}
            )
            # Get public URL
            audio_url = supabase.storage.from_("meeting-audio").get_public_url(audio_path)
            # Update meeting with audio URL
            supabase.table("meetings").update({"audio_url": audio_url}).eq("id", meeting_id).execute()
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to store audio in storage: {e}")

        # Set initial status
        supabase.table("meetings").update({"processing_status": "transcribing"}).eq("id", meeting_id).execute()

        # Add to background tasks (returns immediately)
        background_tasks.add_task(run_processing_pipeline, meeting_id, audio_bytes, filename)

        return {"meeting_id": meeting_id, "status": "processing_started"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/meetings/{meeting_id}/retry-transcription")
async def retry_transcription(
    meeting_id: str,
    background_tasks: BackgroundTasks,
):
    """
    Retry transcription for a failed meeting using stored audio.
    """
    try:
        # Get meeting with audio_url
        res = supabase.table("meetings").select("id, audio_url, processing_status").eq("id", meeting_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Meeting not found")

        meeting = res.data[0]
        if not meeting.get("audio_url"):
            raise HTTPException(status_code=400, detail="No audio available for this meeting")

        # Reset status and start processing
        supabase.table("meetings").update({
            "processing_status": "transcribing",
            "processing_error": None
        }).eq("id", meeting_id).execute()

        # Download audio from storage and process
        audio_path = meeting["audio_url"].split("/")[-2] + "/" + meeting["audio_url"].split("/")[-1]
        audio_data = supabase.storage.from_("meeting-audio").download(audio_path)
        background_tasks.add_task(run_processing_pipeline, meeting_id, audio_data, f"meeting_{meeting_id}.webm")

        return {"meeting_id": meeting_id, "status": "retry_started"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/meetings/{meeting_id}/retry-extraction")
async def retry_extraction(
    meeting_id: str,
    background_tasks: BackgroundTasks,
):
    """
    Retry intelligence extraction for a meeting that has a transcript but failed extraction.
    """
    try:
        # Get meeting with transcript
        res = supabase.table("meetings").select("id, transcript, processing_status").eq("id", meeting_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Meeting not found")

        meeting = res.data[0]
        if not meeting.get("transcript"):
            raise HTTPException(status_code=400, detail="No transcript available for this meeting")

        # Only allow retry if status is failed and we have a transcript
        if meeting["processing_status"] != "failed":
            raise HTTPException(status_code=400, detail="Can only retry failed meetings")

        # Reset status and start extraction
        supabase.table("meetings").update({
            "processing_status": "extracting",
            "processing_error": None
        }).eq("id", meeting_id).execute()

        # Run extraction in background
        background_tasks.add_task(run_extraction_only, meeting_id, meeting["transcript"])

        return {"meeting_id": meeting_id, "status": "extraction_retry_started"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/meetings/{meeting_id}/intelligence")
def get_meeting_intelligence(meeting_id: str):
    """Return extracted intelligence for a completed meeting."""
    try:
        # Check meeting status
        meeting_res = supabase.table("meetings").select("processing_status").eq("id", meeting_id).execute()
        if not meeting_res.data:
            raise HTTPException(status_code=404, detail="Meeting not found")

        if meeting_res.data[0]["processing_status"] != "complete":
            raise HTTPException(status_code=404, detail="Intelligence not yet available")

        intel_res = supabase.table("meeting_intelligence").select("*").eq("meeting_id", meeting_id).execute()
        if not intel_res.data:
            raise HTTPException(status_code=404, detail="Intelligence record not found")

        # Also get meeting_number and meeting_date
        full_meeting_res = supabase.table("meetings").select("meeting_number, meeting_date, deal_id").eq("id", meeting_id).execute()
        intel = intel_res.data[0]
        if full_meeting_res.data:
            intel["meeting_number"] = full_meeting_res.data[0].get("meeting_number")
            intel["meeting_date"] = full_meeting_res.data[0].get("meeting_date")

        return intel

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
