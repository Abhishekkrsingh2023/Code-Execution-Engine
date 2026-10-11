from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.routers import code_routes, root_routes


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
app.add_middleware(
    GZipMiddleware,
    minimum_size=1000,
    compresslevel=5
)  # used for data compression for saving bandwidth

app.include_router(code_routes.router)
app.include_router(root_routes.router)

