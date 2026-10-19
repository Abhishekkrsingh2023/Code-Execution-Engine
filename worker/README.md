# Code0 — Execution Worker

Background asynchronous code execution worker for the Code0 platform.

## Architecture

- **`worker.py`**: Redis queue listener and execution dispatcher
- **`container.py`**: Sandboxed Docker container runner (Python, C, C++, Java) with strict memory, CPU, and process limits
- **`models.py`**: Synchronous SQLAlchemy data models
- **`database.py`**: Synchronous psycopg connection pool for worker transactions
- **`config.py`**: Worker runtime settings and sandbox environment configuration
- **`tests/`**: Unit and integration tests for container orchestration and worker tasks

## Running Locally

```bash
# Install dependencies
uv sync

# Run execution worker
uv run python worker.py

# Run worker tests
uv run pytest
```
