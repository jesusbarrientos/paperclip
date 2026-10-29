#!/usr/bin/env bash
# Rebuilds the staging database from production. Run on srv-01 (the Dokploy
# host) as a user that can use docker. Production is only read (pg_dump).
#
#   PROD_DB=<prod postgres container>  STAGING_DB=<staging postgres container> \
#   STAGING_SERVER=<staging server container> ./refresh.sh
#
# Container names: `docker ps --format '{{.Names}}' | grep -i paperclip`.
# Optional: COMPANY (default "Apartment List"), PROD_DB_USER/NAME, STAGING_DB_USER/NAME.
set -euo pipefail

: "${PROD_DB:?set PROD_DB}" "${STAGING_DB:?set STAGING_DB}" "${STAGING_SERVER:?set STAGING_SERVER}"
COMPANY="${COMPANY:-Apartment List}"
PROD_DB_USER="${PROD_DB_USER:-paperclip}";       PROD_DB_NAME="${PROD_DB_NAME:-paperclip}"
STAGING_DB_USER="${STAGING_DB_USER:-paperclip}"; STAGING_DB_NAME="${STAGING_DB_NAME:-paperclip}"
HERE="$(cd "$(dirname "$0")" && pwd)"
DUMP="$(mktemp -t paperclip-prod-XXXX.dump)"
trap 'rm -f "$DUMP"' EXIT

echo "==> Stopping staging server so nothing writes during the restore"
docker stop "$STAGING_SERVER" >/dev/null

echo "==> Dumping production ($PROD_DB, read-only)"
docker exec "$PROD_DB" pg_dump -U "$PROD_DB_USER" -d "$PROD_DB_NAME" -Fc --no-owner --no-acl > "$DUMP"

echo "==> Recreating staging database"
docker exec "$STAGING_DB" psql -U "$STAGING_DB_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"$STAGING_DB_NAME\" WITH (FORCE)" \
  -c "CREATE DATABASE \"$STAGING_DB_NAME\""
docker exec -i "$STAGING_DB" pg_restore -U "$STAGING_DB_USER" -d "$STAGING_DB_NAME" --no-owner --no-acl < "$DUMP"

echo "==> Sanitizing: keep '$COMPANY', drop integrations, pause automation"
docker exec -i "$STAGING_DB" psql -U "$STAGING_DB_USER" -d "$STAGING_DB_NAME" -v company="$COMPANY" < "$HERE/sanitize.sql"

echo "==> Starting staging server"
docker start "$STAGING_SERVER" >/dev/null
echo "Done. Agents and routines are paused; secrets and connectors are empty."
