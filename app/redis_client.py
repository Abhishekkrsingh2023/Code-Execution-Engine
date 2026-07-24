import redis.asyncio as redis_async
import redis as redis_sync

_async_redis_client = redis_async.Redis(host='localhost', port=6379, decode_responses=True)
_redis_sync_client = redis_sync.Redis(host='localhost', port=6379, decode_responses=True)


def get_async_redis_client():
    return _async_redis_client

def get_sync_redis_client():
    return _redis_sync_client


