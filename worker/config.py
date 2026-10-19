import pathlib

from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    """Configuration settings for the independent synchronous code execution worker."""

    # Redis configuration
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str | None = None
    REDIS_QUEUE_NAME: str = "code:queue"
    REDIS_SUBMISSION_KEY_PREFIX: str = "submission:"
    REDIS_RECONNECT_DELAY: int = 5
    REDIS_SOCKET_TIMEOUT: int = 30
    REDIS_CONNECT_TIMEOUT: int = 10

    # PostgreSQL configuration
    DATABASE_URL: str = "postgresql+psycopg://postgres:password@localhost:5432/code_buddy"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE: int = 1800
    SQL_ECHO: bool = False

    # Code Execution and Storage
    CODE_BASE_DIR: str | None = None
    HOST_CODE_BASE_DIR: str | None = None

    # Sandbox Docker Container Limits & Images
    CONTAINER_MEMORY_LIMIT: str = "128m"
    CONTAINER_CPU_LIMIT: str = "0.5"
    CONTAINER_PIDS_LIMIT: int = 50

    DOCKER_IMAGE_PYTHON: str = "python:3.12-alpine"
    DOCKER_IMAGE_CPP: str = "gcc:12.5"
    DOCKER_IMAGE_C: str = "gcc:12.5"
    DOCKER_IMAGE_JAVA: str = "eclipse-temurin:22-jdk-alpine"

    # Worker logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE_PATH: str | None = None
    LOG_ROTATION: str = "10 MB"
    LOG_RETENTION: str = "30 days"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def sync_database_url(self) -> str:
        """Ensures a synchronous psycopg database driver URL is returned."""
        url = self.DATABASE_URL
        if "+asyncpg" in url:
            url = url.replace("+asyncpg", "+psycopg")
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

    @property
    def docker_images(self) -> dict[str, str]:
        """Mapping from language identifier to Docker image name."""
        return {
            "python": self.DOCKER_IMAGE_PYTHON,
            "cpp": self.DOCKER_IMAGE_CPP,
            "c": self.DOCKER_IMAGE_C,
            "java": self.DOCKER_IMAGE_JAVA,
        }

    def resolve_code_base(self, base_path: pathlib.Path | None = None) -> pathlib.Path:
        """Resolves the base directory for code submissions."""
        if self.CODE_BASE_DIR:
            p = pathlib.Path(self.CODE_BASE_DIR).resolve()
        else:
            root = base_path or pathlib.Path.cwd()
            candidate = root / "backend" / "code"
            if candidate.exists():
                p = candidate.resolve()
            elif (root.parent / "backend" / "code").exists():
                p = (root.parent / "backend" / "code").resolve()
            else:
                p = candidate.resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = WorkerSettings()
