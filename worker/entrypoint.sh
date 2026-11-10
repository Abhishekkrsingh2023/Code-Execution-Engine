#!/bin/sh
set -e

echo "[worker] Verifying connection to Docker daemon at ${DOCKER_HOST:-unix:///var/run/docker.sock}..."
until docker info >/dev/null 2>&1; do
    echo "[worker] Waiting for DinD daemon to be ready..."
    sleep 1
done
echo "[worker] Docker daemon is reachable."

echo "[worker] Pre-pulling execution runtime images into DinD..."
docker pull python:3.12-alpine || true
docker pull gcc:12.5 || true
docker pull eclipse-temurin:22-jdk-alpine || true
echo "[worker] Language execution images pre-pulled."

# Periodic cleanup loop in background to prune dind_data
(
    while true; do
        sleep 3600
        docker system prune -f >/dev/null 2>&1 || true
    done
) &

echo "[worker] Starting code execution worker process..."
exec python worker.py
