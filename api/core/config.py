"""
Application configuration using pydantic-settings.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Stack Configuration
    NEXT_PUBLIC_STACK_PROJECT_ID: str
    NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY: str
    STACK_SECRET_SERVER_KEY: str

    # Supabase Configuration
    SUPABASE_URL: str
    SUPABASE_PUBLISHABLE_DEFAULT_KEY: str

    # Google Generative AI Configuration
    GOOGLE_GENERATIVE_AI_API_KEY: str

    # Gemini Configuration
    GEMINI_MODEL: str = "gemini-2.5-flash-lite"
    MAX_OUTPUT_TOKENS: int = 2048
    DEFAULT_TEMPERATURE: float = 0.5
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10 MB

    # Logging Configuration
    LOG_LEVEL: str = "INFO"

    # Sentry (optional; omit or leave empty to disable error reporting)
    SENTRY_DSN: str | None = None
    ENVIRONMENT: str = "local"

    model_config = SettingsConfigDict(
        env_file=".env.local", extra="ignore", case_sensitive=True
    )


# Global settings instance
settings = Settings()
