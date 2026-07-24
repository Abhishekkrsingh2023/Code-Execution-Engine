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
    echo=True,  # Set to True for SQL query logging, useful for debugging
    pool_size=settings.POOL_SIZE, # (No of concurrent connections to the database)
    max_overflow=settings.MAX_OVERFLOW, # (No of connections that can be created beyond the pool_size)
    pool_recycle=settings.POOL_RECYCLE, # (Time in seconds after which a connection is recycled)
    pool_pre_ping=True,
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