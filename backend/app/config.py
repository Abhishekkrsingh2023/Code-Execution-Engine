import pathlib
import warnings

from pydantic import model_validator
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

    # Code Execution and Storage
    CODE_BASE_DIR: str | None = None

    # Debugging — set SQL_ECHO=true in .env to log queries (never enable in production)
    SQL_ECHO: bool = False

    # Logging
    LOG_FILE_PATH: str = "logs/audit.log"
    LOG_ROTATION: str = "10 MB"
    LOG_RETENTION: str = "30 days"

    # Application environment — set ENVIRONMENT=production in .env for production deployments
    ENVIRONMENT: str = "development"

    # JWT Authentication
    JWT_SECRET_KEY: str = "temporary-secret-key-change-in-production-code-buddy"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Cookie Authentication Settings
    ACCESS_TOKEN_COOKIE_NAME: str = "access_token"
    REFRESH_TOKEN_COOKIE_NAME: str = "refresh_token"
    COOKIE_SECURE: bool = (
        True  # Always True by default; override to False only in .env for local dev
    )
    COOKIE_HTTPONLY: bool = True
    COOKIE_SAMESITE: str = "lax"
    COOKIE_PATH: str = "/"
    COOKIE_DOMAIN: str | None = None

    # Redis Token Store Prefixes
    REDIS_REFRESH_TOKEN_PREFIX: str = "refresh_token:"
    REDIS_REVOKED_TOKEN_PREFIX: str = "revoked_token:"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def _validate_secrets(self) -> "Settings":
        """Refuse to start with the default JWT secret outside of development.

        In production (ENVIRONMENT != 'development') this raises immediately so
        the service never boots with a publicly-known signing key.
        In development a warning is emitted instead so local setups keep working.
        """
        _DEFAULT_SECRET = "temporary-secret-key-change-in-production-code-buddy"
        if self.JWT_SECRET_KEY == _DEFAULT_SECRET:
            if self.ENVIRONMENT.lower() == "development":
                warnings.warn(
                    "JWT_SECRET_KEY is set to the insecure default value. "
                    "Set a strong secret in your .env file before deploying to production.",
                    stacklevel=2,
                )
            else:
                raise ValueError(
                    "JWT_SECRET_KEY must be overridden in production. "
                    'Generate a strong secret with: python -c "import secrets; print(secrets.token_hex(32))"'
                )
        if self.ENVIRONMENT.lower() != "development" and not self.COOKIE_SECURE:
            warnings.warn(
                "COOKIE_SECURE is False in a non-development environment. "
                "Auth cookies will be transmitted over plain HTTP.",
                stacklevel=2,
            )
        return self

    def resolve_code_dir(self) -> pathlib.Path:
        """Resolves the base directory for code submissions."""
        if self.CODE_BASE_DIR:
            p = pathlib.Path(self.CODE_BASE_DIR).resolve()
        else:
            backend_root = pathlib.Path(__file__).resolve().parent.parent
            p = (backend_root / "code").resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()
