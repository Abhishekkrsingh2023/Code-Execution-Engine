from fastapi import APIRouter, HTTPException, Request, status

from app.limiter import limiter
from app.redis_client import get_async_redis_client

router = APIRouter()


@router.get("/ping-redis")
@router.get("/api-v1/ping-redis")
@limiter.limit("5/minute")
async def ping_redis(request: Request) -> dict[str, str]:
    try:
        pong = await get_async_redis_client().ping()
        if pong:
            return {"message": "Pong from Redis!"}
        else:
            return {"message": "Failed to ping Redis."}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to ping Redis.",
        ) from exc


@router.get("/health")
@router.get("/api-v1/health")
def health_check() -> dict[str, str]:
    return {"status": "healthy"}
