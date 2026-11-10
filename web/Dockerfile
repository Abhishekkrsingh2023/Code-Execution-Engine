# syntax=docker/dockerfile:1
# Multi-stage Dockerfile for Next.js Web Frontend (standalone runner)

# --- Stage 1: Build ---
FROM oven/bun:1.4.4-alpine AS builder
WORKDIR /app

# Build arguments for baked-in environment variables
ARG API_BASE_URL=http://backend:8000
ARG SERVER_ACTIONS_ALLOWED_ORIGINS=localhost:3000,127.0.0.1:3000,code0.bbitclub.io
ENV API_BASE_URL=${API_BASE_URL}
ENV SERVER_ACTIONS_ALLOWED_ORIGINS=${SERVER_ACTIONS_ALLOWED_ORIGINS}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Install dependencies first for layer caching
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy application source code
COPY . .

# Build Next.js application (generates .next/standalone)
RUN bun run build

# --- Stage 2: Production Runner ---
FROM oven/bun:1.4.4-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy minimal standalone build output and static assets
COPY --from=builder --chown=bun:bun /app/public ./public
COPY --from=builder --chown=bun:bun /app/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/.next/static ./.next/static

USER bun
EXPOSE 3000

CMD ["bun", "server.js"]
