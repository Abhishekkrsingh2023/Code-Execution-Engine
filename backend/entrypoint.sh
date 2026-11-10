#!/bin/sh
set -e

echo "[backend] Running database migrations..."
alembic upgrade head

echo "[backend] Starting FastAPI server on 0.0.0.0:8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
