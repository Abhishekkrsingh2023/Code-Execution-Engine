from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

try:
    from worker.config import settings
except ImportError:
    # pyrefly: ignore[missing-import]
    from config import settings

engine = create_engine(
    settings.sync_database_url,
    echo=settings.SQL_ECHO,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_recycle=settings.DB_POOL_RECYCLE,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    class_=Session,
    autoflush=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session]:
    """Provides a synchronous database session."""
    with SessionLocal() as session:
        yield session
