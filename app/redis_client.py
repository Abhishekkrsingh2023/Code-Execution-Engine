import redis.asyncio as redis_async
import redis as redis_sync

from app.config import settings

_async_redis_client = redis_async.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    decode_responses=True,
    socket_keepalive=True,
    retry_on_timeout=True,
)

_redis_sync_client = redis_sync.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    decode_responses=True,
    socket_keepalive=True,
    retry_on_timeout=True,
)


def get_async_redis_client():
    return _async_redis_client

def get_sync_redis_client():
    return _redis_sync_client
