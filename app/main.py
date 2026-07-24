from fastapi import FastAPI

from app.redis_client import get_async_redis_client
from app.routers import code_routes, problem_setter

redis_client = get_async_redis_client()

app = FastAPI(
    title="Code Executor API",
    description="An API for executing code submissions against programming problems.",
    version="1.0.0",
    contact={
        "name": "Abhishek",
        "email": "abhishek@example.com"
    }
)

app.include_router(code_routes.router)
app.include_router(problem_setter.router)

@app.get("/ping-redis")
async def ping_redis():
    try:
        pong = await redis_client.ping()
        if pong:
            return {"message": "Pong from Redis!"}
        else:
            return {"message": "Failed to ping Redis."}
    except Exception as e:
        return {"error": str(e)}

@app.get("/health")
def health_check():
    return {"status": "healthy"}


