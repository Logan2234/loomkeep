#!/usr/bin/env bash
# Runs on the VPS, from the checkout deploy.yml's deploy job has just reset to the commit
# CI validated (DEPLOY_SHA). Which compose files run comes from COMPOSE_FILE
# in the VPS's own .env, not from here.
#
# Safety net: a dump of the database before the new images start (their
# api runs `prisma migrate deploy` at boot), and when the new containers
# never become healthy, a return to the previous images — unless a
# migration already ran, since old code on a newer schema can be worse than
# a failed deploy. Either way the job fails, so ntfy alerts.
set -euo pipefail

: "${DEPLOY_SHA:?DEPLOY_SHA must be set}"

set -a
# shellcheck disable=SC1091
source .env
set +a

DUMP_DIR="$HOME/loomkeep-predeploy"
DB_USER="${POSTGRES_USER:-loomkeep}"
DB_NAME="${POSTGRES_DB:-loomkeep}"

# The tag the running api uses (empty on a first deploy).
previous_tag=""
if api=$(docker compose ps -q api) && [ -n "$api" ]; then
  previous_tag=$(docker inspect -f '{{.Config.Image}}' "$api" | sed -n 's/.*://p')
fi

applied_migrations() {
  docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL" \
    2>/dev/null || echo 0
}

# Encrypted for the same age key as every other backup; the plaintext only
# exists in the pipe. The last 5 are kept.
mkdir -p "$DUMP_DIR"
dump="$DUMP_DIR/predeploy-$(date -u +%Y%m%dT%H%M%SZ)-${DEPLOY_SHA:0:12}.sql.age"
if [ -n "$previous_tag" ]; then
  docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges |
    age -r "$BACKUP_ENCRYPTION_PUBLIC_KEY" >"$dump"
  echo "Pre-deploy dump: $dump"
  # shellcheck disable=SC2012 # our own timestamped names, no spaces
  ls -1t "$DUMP_DIR"/predeploy-*.sql.age | tail -n +6 | xargs -r rm --
fi
migrations_before=$(applied_migrations)

# Pins api/web to the images CI pushed for this commit (images.yml's
# docker-push), not the floating `latest`. Also feeds the Homepage
# "Version" widget, which reads GIT_SHA baked into the api image.
export IMAGE_TAG="${DEPLOY_SHA:0:12}"
docker compose pull

# "port is already allocated" right after a previous deploy is a transient
# Docker race: retried a few times. --remove-orphans drops services removed
# from COMPOSE_FILE.
start() {
  for attempt in 1 2 3; do
    if docker compose up -d --remove-orphans; then
      return 0
    fi
    echo "docker compose up -d failed (attempt $attempt/3), retrying in 5s..."
    sleep 5
  done
  return 1
}

# A migration Prisma started and hasn't finished. A failed one has no
# finished_at either, but Prisma writes its error to `logs`: only a migration
# still running has neither.
migration_running() {
  local running
  running=$(docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc     "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL AND logs IS NULL"     2>/dev/null) || return 1
  [ "${running:-0}" -gt 0 ]
}

# `up -d` returns as soon as containers start: an api stuck on a failed
# migration would hide behind it. Waits for docker-compose.yml's
# healthchecks, up to 5 minutes per service. The api only answers once
# `prisma migrate deploy` is done, so while a migration is still running its
# wait goes on, up to an hour: cutting a long backfill short used to restart
# the previous images over a half-applied migration.
healthy() {
  for service in api web; do
    container=$(docker compose ps -q "$service")
    for attempt in $(seq 1 720); do
      status=$(docker inspect -f '{{.State.Health.Status}}' "$container")
      [ "$status" = healthy ] && break
      if [ "$attempt" -ge 60 ] && { [ "$service" != api ] || [ "$attempt" = 720 ] || ! migration_running; }; then
        echo "$service is still $status after $((attempt * 5 / 60)) minutes" >&2
        docker compose logs --tail=80 "$service" >&2
        return 1
      fi
      if [ "$attempt" = 60 ]; then
        echo "A migration is still running: waiting for it (up to an hour)."
      fi
      sleep 5
    done
  done
}

# Caddy's config files are single-file bind mounts: the reset replaced them
# with new inodes, so the running container still reads the old ones, and
# `up -d` doesn't recreate it when only their content changed. Recreated when
# any of them differs from the checkout (a few seconds without the proxy).
caddy_config_stale() {
  local container source destination
  container=$(docker compose ps -q caddy)
  [ -n "$container" ] || return 1
  while read -r source destination; do
    case "$destination" in /etc/caddy/*) ;; *) continue ;; esac
    if ! docker exec "$container" cat "$destination" | cmp -s - "$source"; then
      return 0
    fi
  done < <(docker inspect -f '{{range .Mounts}}{{.Source}} {{.Destination}}{{"\n"}}{{end}}' "$container")
  return 1
}

if start && healthy; then
  if caddy_config_stale; then
    echo "Caddy's config changed: recreating it."
    docker compose up -d --no-deps --force-recreate caddy
  fi
  # A day of unused images keeps the previous pair for a manual rollback;
  # a week of them, with several deploys a day, filled the disk. Images in
  # use are never removed.
  docker image prune -a -f --filter "until=24h"
  docker builder prune -f --filter "until=24h"
  exit 0
fi

echo "::error::The ${IMAGE_TAG} images didn't come up healthy." >&2
if [ -z "$previous_tag" ]; then
  echo "No previous images to return to." >&2
elif [ "$(applied_migrations)" != "$migrations_before" ]; then
  echo "A migration ran, so the previous images stay stopped: old code on the" >&2
  echo "new schema could corrupt data. Restore $dump or fix forward." >&2
else
  echo "No migration ran: returning to the previous images ($previous_tag)." >&2
  export IMAGE_TAG="$previous_tag"
  start && healthy && echo "Back on $previous_tag." >&2
fi
exit 1
