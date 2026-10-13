from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.routers import admin_routes, code_routes, problem_routes, root_routes, user_routes
from app.utils.audit_logger import setup_audit_logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize audit file logger with loguru
    setup_audit_logger()
    yield


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
    allow_origins=["*"],
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



