FROM python:3.13-slim

# Install Docker CLI so the worker can orchestrate runner sandboxes via the Docker daemon
RUN apt-get update && apt-get install -y --no-install-recommends \
    docker.io \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install worker dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy worker source code into /app/worker
COPY . /app/worker

ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app:/app/worker \
    REDIS_HOST=redis \
    REDIS_PORT=6379 \
    DATABASE_URL=postgresql+psycopg://postgres:password@postgres:5432/code_buddy \
    CODE_BASE_DIR=/code

CMD ["python", "-m", "worker"]
