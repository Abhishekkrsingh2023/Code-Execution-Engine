import redis as redis_sync
import redis.asyncio as redis_async

from app.config import settings

_async_redis_client = redis_async.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    decode_responses=True,
    socket_keepalive=True,
)

_redis_sync_client = redis_sync.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    decode_responses=True,
    socket_keepalive=True,
)


def get_async_redis_client() -> redis_async.Redis:
    return _async_redis_client


def get_sync_redis_client() -> redis_sync.Redis:
    return _redis_sync_client
