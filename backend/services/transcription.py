import httpx
import logging
from config import settings

logger = logging.getLogger(__name__)

async def transcribe_audio(audio_bytes: bytes, filename: str) -> str:
    """Send audio bytes to Groq Whisper transcription endpoint and return the transcript.

    Args:
        audio_bytes: Raw audio file bytes.
        filename: Original filename (used for multipart part header).
    Returns:
        The transcript text.
    """
    logger.info(f"Transcribing audio file {filename}, size={len(audio_bytes)} bytes")
    headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
    async with httpx.AsyncClient(timeout=120) as client:
        files = {"file": (filename, audio_bytes, "audio/webm")}
        data = {"model": "whisper-large-v3", "response_format": "text"}
        response = await client.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers=headers,
            files=files,
            data=data,
        )
        if response.status_code >= 400:
            raise ValueError(f"Transcription failed: {response.text}")
        return response.text
