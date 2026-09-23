from sqlalchemy.ext.asyncio import (
    AsyncSession, 
    create_async_engine,
    async_sessionmaker
)

from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# Base class for all ORM models
class Base(DeclarativeBase):
    pass


DATABASE_URL = settings.DATABASE_URL

engine = create_async_engine(
    DATABASE_URL,
    # echo logs every SQL statement — only enable via SQL_ECHO=true in .env, never in production
    echo=settings.SQL_ECHO,
    pool_size=settings.POOL_SIZE,       # no. of persistent connections to the database
    max_overflow=settings.MAX_OVERFLOW, # extra connections allowed beyond pool_size
    pool_recycle=settings.POOL_RECYCLE, # recycle connections after this many seconds
    pool_pre_ping=True,                 # verify connections before use (detects stale sockets)
)

SessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession,autoflush=False, expire_on_commit=False)

# Alembic handles database migrations, so we don't need to create tables manually. The following function is commented out because it's not needed for Alembic migrations.
# async def init_db():
#     async with engine.begin() as conn:
#         await conn.run_sync(Base.metadata.create_all)

async def get_db():
    """Dependency that provides an async database session for each request."""
    async with SessionLocal() as session:
        yield session