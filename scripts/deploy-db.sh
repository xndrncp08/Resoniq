#!/usr/bin/env bash
# Brings a production database up to date, safely:
#   1. refuses anything but a direct postgres:// URL;
#   2. takes a pg_dump backup first (custom format, restorable with pg_restore);
#   3. shows which migrations are pending;
#   4. refuses to run the historical UserWorkspace drop if that table holds rows;
#   5. applies pending migrations (never resets) and runs the idempotent
#      structural seed (communities, moderation rules, gear catalog).
#
#   PROD_DATABASE_URL='postgres://…' scripts/deploy-db.sh
#
# Needs pg_dump at least as new as the server (e.g. `brew install postgresql@17`).
set -euo pipefail
: "${PROD_DATABASE_URL:?set PROD_DATABASE_URL to the direct postgres:// connection string}"
case "$PROD_DATABASE_URL" in postgres://*|postgresql://*) ;; *) echo "Use the direct postgres:// URL, not an Accelerate/pooled prisma:// URL." >&2; exit 1 ;; esac
cd "$(dirname "$0")/../frontend"
BACKUP_DIR="${BACKUP_DIR:-../../db-backups}"
mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/resoniq-prod-$(date -u +%Y%m%dT%H%M%SZ).dump"

echo "== backup → $FILE"
pg_dump "$PROD_DATABASE_URL" -Fc --no-owner -f "$FILE"
pg_restore --list "$FILE" > /dev/null
echo "backup ok ($(du -h "$FILE" | cut -f1))"

echo "== current state"
psql "$PROD_DATABASE_URL" -Atc "SELECT 'applied migrations: ' || count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL" 2>/dev/null || echo "applied migrations: none (fresh database)"
psql "$PROD_DATABASE_URL" -Atc "SELECT 'users: ' || count(*) FROM \"User\"" 2>/dev/null || true
DATABASE_URL="$PROD_DATABASE_URL" npx prisma migrate status || true

ws=$(psql "$PROD_DATABASE_URL" -Atc "SELECT to_regclass('public.\"UserWorkspace\"') IS NOT NULL AND EXISTS (SELECT 1 FROM \"UserWorkspace\")" 2>/dev/null || echo f)
if [ "$ws" = "t" ]; then
  echo "UserWorkspace still has rows and a pending migration drops that table. Export it first, then re-run with ALLOW_WORKSPACE_DROP=1." >&2
  [ "${ALLOW_WORKSPACE_DROP:-}" = 1 ] || exit 1
fi

echo "== migrate (deploy only; never reset)"
DATABASE_URL="$PROD_DATABASE_URL" npx prisma migrate deploy
echo "== structural seed (idempotent upserts; no users or posts)"
DATABASE_URL="$PROD_DATABASE_URL" npx tsx prisma/seed.ts
psql "$PROD_DATABASE_URL" -Atc "SELECT 'users ' || (SELECT count(*) FROM \"User\") || ', tones ' || (SELECT count(*) FROM \"Tone\") || ', communities ' || (SELECT count(*) FROM \"Community\") || ', gear ' || (SELECT count(*) FROM \"GearItem\")"
echo "done. Backup kept at $FILE"
