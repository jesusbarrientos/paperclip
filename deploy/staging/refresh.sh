#!/usr/bin/env bash
# Rebuilds the staging database from production. Run on srv-01 (the Dokploy
# host) as a user that can use docker. Production is only read (pg_dump).
#
#   PROD_DB=<prod postgres>  STAGING_DB=<staging postgres>  STAGING_SERVER=<staging server> ./refresh.sh
#
# Each value is a container name or the start of one. Dokploy runs apps and
# databases as swarm services whose containers are named <appName>.1.<task>,
# so the Dokploy "App Name" is enough. The staging server is scaled to 0 with
# `docker service scale` while restoring: a plain `docker stop` would be
# restarted by swarm.
# Optional: COMPANY (default "Apartment List"), PROD_DB_USER/NAME, STAGING_DB_USER/NAME.
set -euo pipefail

: "${PROD_DB:?set PROD_DB}" "${STAGING_DB:?set STAGING_DB}" "${STAGING_SERVER:?set STAGING_SERVER}"
COMPANY="${COMPANY:-Apartment List}"
PROD_DB_USER="${PROD_DB_USER:-paperclip}";       PROD_DB_NAME="${PROD_DB_NAME:-paperclip}"
STAGING_DB_USER="${STAGING_DB_USER:-paperclip}"; STAGING_DB_NAME="${STAGING_DB_NAME:-paperclip}"
HERE="$(cd "$(dirname "$0")" && pwd)"
DUMP="$(mktemp -t paperclip-prod-XXXX.dump)"
trap 'rm -f "$DUMP"' EXIT

container() {
  local name
  name="$(docker ps --format '{{.Names}}' | grep -m1 -- "^$1" || true)"
  [ -n "$name" ] || { echo "No running container starts with '$1'" >&2; exit 1; }
  echo "$name"
}
is_service() { docker service inspect "$STAGING_SERVER" >/dev/null 2>&1; }

PROD_C="$(container "$PROD_DB")"
STAGING_C="$(container "$STAGING_DB")"
echo "Production db: $PROD_C"
echo "Staging db:    $STAGING_C"

echo "==> Stopping staging server so nothing writes during the restore"
if is_service; then
  docker service scale -d "$STAGING_SERVER=0" >/dev/null
else
  STAGING_SERVER_C="$(container "$STAGING_SERVER")"
  docker stop "$STAGING_SERVER_C" >/dev/null
fi

echo "==> Dumping production (read-only)"
docker exec "$PROD_C" pg_dump -U "$PROD_DB_USER" -d "$PROD_DB_NAME" -Fc --no-owner --no-acl > "$DUMP"
echo "    dump size: $(du -h "$DUMP" | cut -f1)"

echo "==> Recreating staging database"
docker exec "$STAGING_C" psql -U "$STAGING_DB_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"$STAGING_DB_NAME\" WITH (FORCE)" \
  -c "CREATE DATABASE \"$STAGING_DB_NAME\""
docker exec -i "$STAGING_C" pg_restore -U "$STAGING_DB_USER" -d "$STAGING_DB_NAME" --no-owner --no-acl < "$DUMP"

echo "==> Sanitizing: keep '$COMPANY', drop integrations, pause automation"
docker exec -i "$STAGING_C" psql -U "$STAGING_DB_USER" -d "$STAGING_DB_NAME" -v company="$COMPANY" < "$HERE/sanitize.sql"

echo "==> Starting staging server"
if is_service; then
  docker service scale -d "$STAGING_SERVER=1" >/dev/null
else
  docker start "$STAGING_SERVER_C" >/dev/null
fi
echo "Done. Agents and routines are paused; secrets and connectors are empty."
