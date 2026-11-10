# syntax=docker/dockerfile:1
FROM python:3.13-slim

WORKDIR /app

# Install curl for healthcheck & clean apt lists
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv from official binary
COPY --from=ghcr.io/astral-sh/uv:0.6.14 /uv /uvx /bin/

# Create non-root user
RUN useradd -m -u 1000 appuser

# Dependencies layer caching
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Put virtual environment in PATH
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Copy source code
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app
COPY entrypoint.sh ./

# Prepare runtime directories and file ownership
RUN mkdir -p /app/code /app/logs \
    && chmod +x /app/entrypoint.sh \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
