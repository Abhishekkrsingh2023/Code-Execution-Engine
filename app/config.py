class Settings:
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    REDIS_QUEUE_NAME: str = "code:queue"
    REDIS_SUBMISSION_KEY_PREFIX: str = "submission:"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/code_buddy"
    POOL_SIZE: int = 10
    MAX_OVERFLOW: int = 20
    POOL_RECYCLE: int = 1800 

settings = Settings()