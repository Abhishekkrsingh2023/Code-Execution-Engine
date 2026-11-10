# syntax=docker/dockerfile:1
FROM python:3.13-slim

WORKDIR /app

# Copy Docker CLI client only (no daemon) and uv binary
COPY --from=docker:27.5-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=ghcr.io/astral-sh/uv:0.6.14 /uv /uvx /bin/

# Create non-root user
RUN useradd -m -u 1000 appuser

# Dependencies layer caching
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Put virtual environment in PATH
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Copy source code and logs configuration
COPY config.py database.py container.py models.py services.py worker.py entrypoint.sh ./
COPY logs ./logs

# Prepare runtime directories and file ownership
RUN mkdir -p /app/code /app/logs \
    && chmod +x /app/entrypoint.sh \
    && chown -R appuser:appuser /app

USER appuser

ENTRYPOINT ["/app/entrypoint.sh"]
