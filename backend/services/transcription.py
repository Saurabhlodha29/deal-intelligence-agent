import httpx
import logging
from config import settings

logger = logging.getLogger(__name__)

EXTENSION_TO_MIME = {
    ".webm": "audio/webm",
    ".mp3": "audio/mpeg",
    ".mp4": "audio/mp4",
    ".mpeg": "audio/mpeg",
    ".mpga": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".opus": "audio/opus",
    ".flac": "audio/flac",
    ".wav": "audio/wav",
}

SUPPORTED_EXTENSIONS = set(EXTENSION_TO_MIME.keys())


def normalize_filename(filename: str) -> str:
    """Ensure filename has a recognized audio extension for Groq Whisper."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in SUPPORTED_EXTENSIONS:
        return filename
    return f"{filename}.webm"


def get_mime_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return EXTENSION_TO_MIME.get(f".{ext}", "audio/webm")


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
    safe_filename = normalize_filename(filename)
    mime_type = get_mime_type(safe_filename)
    logger.info(f"Using filename={safe_filename}, mime_type={mime_type}")
    async with httpx.AsyncClient(timeout=120) as client:
        files = {"file": (safe_filename, audio_bytes, mime_type)}
        data = {"model": "whisper-large-v3", "response_format": "text"}
        response = await client.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers=headers,
            files=files,
            data=data,
        )
        if response.status_code >= 400:
            error_detail = response.text
            if "file must be one of the following types" in error_detail:
                raise ValueError(
                    f"Audio format not recognized by Groq. "
                    f"Please convert your file to MP3, WAV, or WebM before uploading. "
                    f"(Original error: {error_detail})"
                )
            raise ValueError(f"Transcription failed (status {response.status_code}): {error_detail}")
        return response.text
