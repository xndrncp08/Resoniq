#!/usr/bin/env bash
# Writes the SQL that takes the committed migrations to the current schema into
# prisma/migrations/<timestamp>_<name>/migration.sql (non-interactive `migrate dev --create-only`).
# Needs SHADOW_DATABASE_URL: an empty scratch database Prisma may wipe.
set -euo pipefail
name=${1:?usage: new-migration.sh <name>}
: "${SHADOW_DATABASE_URL:?set SHADOW_DATABASE_URL}"
cd "$(dirname "$0")/../frontend"
dir="prisma/migrations/$(date -u +%Y%m%d%H%M%S)_${name}"
mkdir -p "$dir"
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL" --script > "$dir/migration.sql"
echo "$dir/migration.sql"
