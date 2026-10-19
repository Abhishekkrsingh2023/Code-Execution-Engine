# Code0 — Backend Service

FastAPI-powered REST API backend for the Code0 code execution and competitive programming platform.

## Architecture

- **`app/`**: Core application package containing:
  - `routers/`: API endpoints (`/api-v1/auth`, `/api-v1/problems`, `/api-v1/code`, `/api-v1/users`, `/api-v1/leaderboard`, `/api-v1/admin`)
  - `models/`: SQLAlchemy ORM models
  - `schemas/`: Pydantic validation schemas
  - `services/`: Business logic layer
  - `controllers/`: Request handling and response coordination
  - `database.py`: Async PostgreSQL database connection pool
  - `redis_client.py`: Async Redis client for pub/sub and job dispatch
  - `config.py`: Environment-driven settings
- **`alembic/` & `alembic.ini`**: Relational database migration scripts
- **`tests/`**: Pytest test suite covering all API routes, authentication, and database operations

## Running Locally

```bash
# Install dependencies
uv sync

# Run database migrations
uv run alembic upgrade head

# Start API development server (port 8000)
uv run fastapi dev app/main.py --port 8000

# Run backend tests
uv run pytest
```
