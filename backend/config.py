from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    GROQ_API_KEY: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    HINDSIGHT_API_KEY: str
    HINDSIGHT_PIPELINE_ID: str
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()