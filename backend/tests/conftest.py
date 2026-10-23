"""Pytest configuration and fixtures.

Provides test fixtures for:
- FastAPI test client via httpx.AsyncClient with ASGITransport
- Isolated PostgreSQL test database session with automatic data cleanup
- Redis test client and state cleanup
- Code submission folder cleanup
"""

import asyncio
import shutil
from collections.abc import AsyncGenerator, Callable, Coroutine, Generator
from datetime import datetime
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.models  # Ensure all models are registered with Base.metadata
from app.config import settings
from app.database import Base, get_db
from app.limiter import limiter
from app.main import app
from app.models.user import User
from app.redis_client import get_async_redis_client

# Define test database URL pointing to the isolated test database
TEST_DATABASE_URL = settings.DATABASE_URL.replace("/code_buddy", "/code_buddy_test")

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    poolclass=NullPool,
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    autoflush=False,
    expire_on_commit=False,
)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database() -> Generator[None]:
    """Session-scoped fixture to create all tables in the test database once."""

    async def _init() -> None:
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(
                text("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(100);")
            )

    async def _teardown() -> None:
        await test_engine.dispose()

    asyncio.run(_init())
    yield
    asyncio.run(_teardown())


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession]:
    """Provides a clean database session for each test.

    Truncates/deletes all rows from all tables after each test to guarantee complete isolation.
    """
    async with TestingSessionLocal() as session:
        yield session
        # Cleanup: delete rows from all tables in reverse dependency order
        for table in reversed(Base.metadata.sorted_tables):
            await session.execute(table.delete())
        await session.commit()


@pytest_asyncio.fixture
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient]:
    """Provides an httpx.AsyncClient using ASGITransport bound to the FastAPI app.

    Overrides the database dependency to use the isolated test session.
    """

    async def _override_get_db() -> AsyncGenerator[AsyncSession]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def reset_rate_limiter() -> Generator[None]:
    """Ensures each test starts and finishes with an isolated, empty rate-limit store."""
    limiter.reset()
    yield
    limiter.reset()


@pytest_asyncio.fixture(autouse=True)
async def cleanup_code_storage() -> AsyncGenerator[None]:
    """Cleans up any temporary code submission folders created in code directory during tests."""
    code_dir = settings.resolve_code_dir()
    yield
    if code_dir.exists():
        for item in code_dir.iterdir():
            if item.is_dir():
                shutil.rmtree(item, ignore_errors=True)
            elif item.is_file():
                item.unlink(missing_ok=True)


@pytest_asyncio.fixture(autouse=True)
async def redis_client() -> AsyncGenerator[Any]:
    """Provides the async Redis client and flushes test keys and connection pool after each test."""
    client = get_async_redis_client()
    yield client
    try:
        # Clean up test keys created during tests
        async for key in client.scan_iter("submission:*"):
            await client.delete(key)
        async for key in client.scan_iter("result:*"):
            await client.delete(key)
        async for key in client.scan_iter("refresh_token:*"):
            await client.delete(key)
        async for key in client.scan_iter("revoked_token:*"):
            await client.delete(key)
        async for key in client.scan_iter("user_refresh_tokens:*"):
            await client.delete(key)
        await client.delete(settings.REDIS_QUEUE_NAME)
    finally:
        # Disconnect pool so next test can safely create connections in its own event loop
        await client.connection_pool.disconnect()


CreateUserCallable = Callable[..., Coroutine[Any, Any, User]]


@pytest_asyncio.fixture
async def create_user(
    db_session: AsyncSession,
) -> CreateUserCallable:
    """Factory fixture to quickly create and persist test users with custom attributes."""
    from app.models.user import User, UserRole, UserStatus
    from app.utils.security import hash_password

    async def _create(
        name: str | None = None,
        username: str = "testuser",
        email: str = "testuser@example.com",
        password: str | None = "Password123!",
        role: UserRole = UserRole.USER,
        status: UserStatus = UserStatus.ACTIVE,
        is_email_verified: bool = True,
        is_protected: bool = False,
        otp: str | None = None,
        otp_expires_at: datetime | None = None,
    ) -> User:
        user = User(
            name=name,
            username=username,
            email=email,
            password_hash=hash_password(password) if password else None,
            role=role,
            status=status,
            is_email_verified=is_email_verified,
            is_protected=is_protected,
            otp=otp,
            otp_expires_at=otp_expires_at,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    return _create


@pytest_asyncio.fixture
async def admin_user(create_user: CreateUserCallable) -> "User":
    """Fixture providing a default administrator user."""
    from app.models.user import UserRole

    return await create_user(
        username="superadmin",
        email="admin@example.com",
        role=UserRole.ADMIN,
    )


@pytest_asyncio.fixture
async def moderator_user(create_user: CreateUserCallable) -> "User":
    """Fixture providing a default moderator user."""
    from app.models.user import UserRole

    return await create_user(
        username="mod_user",
        email="mod@example.com",
        role=UserRole.MODERATOR,
    )


@pytest_asyncio.fixture
async def normal_user(create_user: CreateUserCallable) -> "User":
    """Fixture providing a standard user."""
    from app.models.user import UserRole

    return await create_user(
        username="norm_user",
        email="user@example.com",
        role=UserRole.USER,
    )
