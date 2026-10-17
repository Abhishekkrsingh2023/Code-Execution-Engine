import warnings
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from loguru import logger

from app.routers import (
    admin_routes,
    code_routes,
    leaderboard_routes,
    problem_routes,
    root_routes,
    user_routes,
)
from app.utils.audit_logger import setup_audit_logger

# Suppress harmless CPython 3.13 resource_tracker warning on reloader SIGTERM shutdown
warnings.filterwarnings(
    "ignore",
    category=UserWarning,
    module="multiprocessing.resource_tracker",
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    # Initialize audit file logger with loguru
    sink_id = setup_audit_logger()
    try:
        yield
    finally:
        if sink_id is not None:
            try:
                logger.remove(sink_id)
            except ValueError:
                pass


app = FastAPI(
    title="Code Executor API",
    description="An API for executing code submissions against programming problems.",
    version="1.0.0",
    lifespan=lifespan,
    contact={
        "name": "Abhishek Singh",
        "email": "abhikrsingh.dev@example.com",
    },
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    GZipMiddleware,
    minimum_size=1000,
    compresslevel=5,
)  # used for data compression for saving bandwidth

app.include_router(code_routes.router)
app.include_router(root_routes.router)
app.include_router(user_routes.router)
app.include_router(admin_routes.router)
app.include_router(problem_routes.router)
app.include_router(leaderboard_routes.router)
