#!/bin/sh
set -e

# ── Auto-generate session secret if not provided ─────────────────────────────
SECRET_FILE="/data/.session-secret"
if [ -z "$CW_SESSION_SECRET" ]; then
    if [ -f "$SECRET_FILE" ]; then
        export CW_SESSION_SECRET=$(cat "$SECRET_FILE")
    else
        export CW_SESSION_SECRET=$(cat /dev/urandom | tr -dc 'a-f0-9' | head -c 64)
        mkdir -p /data
        printf '%s' "$CW_SESSION_SECRET" > "$SECRET_FILE"
        chmod 600 "$SECRET_FILE"
    fi
fi

# ── Default admin credentials (demo mode) ────────────────────────────────────
if [ -z "$CW_ADMIN_EMAIL" ]; then
    export CW_ADMIN_EMAIL="admin@chainwarden.local"
    export CW_ADMIN_PASSWORD="changeme123"
    echo ""
    echo "┌─────────────────────────────────────────────────────────────┐"
    echo "│  ChainWarden — running with default credentials           │"
    echo "│                                                             │"
    echo "│  Email:    admin@chainwarden.local                        │"
    echo "│  Password: changeme123                                      │"
    echo "│                                                             │"
    echo "│  Change them:                                               │"
    echo "│  docker run -e CW_ADMIN_EMAIL=you@example.com \\             │"
    echo "│             -e CW_ADMIN_PASSWORD=YourSecurePass \\            │"
    echo "│             -p 3000:3000 ghcr.io/deepak-ff/chainwarden      │"
    echo "└─────────────────────────────────────────────────────────────┘"
    echo ""
fi

# ── All-in-one defaults ──────────────────────────────────────────────────────
export DASHBOARD_DIR="${DASHBOARD_DIR:-/app/dashboard}"
export CW_COOKIE_SECURE="${CW_COOKIE_SECURE:-false}"
export CW_CACHE_PATH="${CW_CACHE_PATH:-/data/scan-cache.json}"
export PORT="${PORT:-3000}"

# ── Ensure cwctl config dir ──────────────────────────────────────────────────
mkdir -p /data/.chainwarden

# ── Database status ──────────────────────────────────────────────────────────
if [ -z "$DATABASE_URL" ]; then
    echo ""
    echo "  No DATABASE_URL — using embedded SQLite (/data/.deepak-ff/supply_chain.db)"
    echo "  Scan history persists across restarts via the /data volume."
    echo "  For PostgreSQL: set DATABASE_URL or use docker compose up -d"
    echo ""
fi

exec /app/chainwarden-api "$@"
