#!/usr/bin/env bash
set -euo pipefail

# Configuration
DOMAINS=("code0.bbitclub.io" "admin.bbit.io")
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Read email from .env if present
EMAIL="admin@bbitclub.io"
if [ -f .env ]; then
    ENV_EMAIL=$(grep -E '^(FROM_EMAIL|SSL_EMAIL)=' .env | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
    if [ -n "$ENV_EMAIL" ]; then
        EMAIL="$ENV_EMAIL"
    fi
fi

STAGING_ARG=""
for arg in "$@"; do
    case "$arg" in
        --staging)
            STAGING_ARG="--staging"
            ;;
        --email=*)
            EMAIL="${arg#*=}"
            ;;
        *)
            echo "Unknown argument: $arg"
            echo "Usage: ./init-letsencrypt.sh [--staging] [--email=you@example.com]"
            exit 1
            ;;
    esac
done

echo "================================================================="
echo "   Code0 — One-Shot Let's Encrypt Certificate Initializer       "
echo "================================================================="
echo "Domains:       ${DOMAINS[*]}"
echo "Contact Email: $EMAIL"
if [ -n "$STAGING_ARG" ]; then
    echo "Mode:          STAGING (Let's Encrypt staging environment, no rate limit)"
else
    echo "Mode:          PRODUCTION"
fi
echo "================================================================="

# Step 1: Activate HTTP-only Nginx configuration
echo "[1/4] Ensuring initial HTTP-only Nginx configuration is active..."
cp "$SCRIPT_DIR/nginx/conf.d/initial-http.conf" "$SCRIPT_DIR/nginx/conf.d/app.conf"

echo "[2/4] Starting Nginx service..."
docker compose up -d nginx

echo "Waiting for Nginx to accept connections on port 80..."
until curl -s -f -o /dev/null "http://127.0.0.1:80/.well-known/acme-challenge/" || true; do
    sleep 1
done

# Step 2: Request certificates using Certbot
echo "[3/4] Requesting SSL certificates from Let's Encrypt..."
for domain in "${DOMAINS[@]}"; do
    echo "--> Requesting certificate for $domain..."
    docker compose run --rm certbot certonly \
        --webroot \
        -w /var/www/certbot \
        $STAGING_ARG \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        -d "$domain"
done

# Step 3: Switch Nginx to HTTPS configuration
echo "[4/4] Activating HTTPS Nginx configuration and reloading..."
cp "$SCRIPT_DIR/nginx/conf.d/app.conf.https" "$SCRIPT_DIR/nginx/conf.d/app.conf"

docker compose exec nginx nginx -s reload || docker compose restart nginx

echo "================================================================="
echo " SSL certificates successfully configured for all domains!"
echo " Web:   https://code0.bbitclub.io"
echo " Admin: https://admin.bbit.io"
echo "================================================================="
