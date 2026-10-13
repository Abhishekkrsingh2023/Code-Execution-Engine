from fastapi import APIRouter, HTTPException, status

from app.redis_client import get_async_redis_client

router = APIRouter()

@router.get("/ping-redis")
async def ping_redis():
    try:
        pong = await get_async_redis_client().ping()
        if pong:
            return {"message": "Pong from Redis!"}
        else:
            return {"message": "Failed to ping Redis."}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to ping Redis.",
        )

@router.get("/health")
def health_check():
    return {"status": "healthy"}
