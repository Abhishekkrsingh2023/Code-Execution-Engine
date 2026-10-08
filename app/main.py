from fastapi import FastAPI

from fastapi.middleware.cors import CORSMiddleware

from app.redis_client import get_async_redis_client
from app.routers import code_routes, problem_setter

redis_client = get_async_redis_client()

app = FastAPI(
    title="Code Executor API",
    description="An API for executing code submissions against programming problems.",
    version="1.0.0",
    contact={
        "name": "Abhishek Singh",
        "email": "abhikrsingh.dev@example.com"
    }
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


