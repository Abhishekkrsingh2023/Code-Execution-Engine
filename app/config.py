from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_QUEUE_NAME: str = "code:queue"
    REDIS_SUBMISSION_KEY_PREFIX: str = "submission:"

    # PostgreSQL
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/code_buddy"
    POOL_SIZE: int = 10
    MAX_OVERFLOW: int = 20
    POOL_RECYCLE: int = 1800

    # Debugging — set SQL_ECHO=true in .env to log queries (never enable in production)
    SQL_ECHO: bool = False

    # Logging
    LOG_FILE_PATH: str = "logs/audit.log"
    LOG_ROTATION: str = "10 MB"
    LOG_RETENTION: str = "30 days"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()