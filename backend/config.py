from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GROQ_API_KEY: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    HINDSIGHT_API_KEY: str

    class Config:
        env_file = ".env"

settings = Settings()
