#!/usr/bin/env bash
set -euo pipefail

# Offsite, encrypted backup of every datastore this VPS runs — not just
# Loomkeep's own database. Complements (doesn't replace) the app's own
# daily dump, which only covers the `loomkeep` database and lives on the
# same disk it's protecting. Run on the VPS host (not inside a container)
# via cron, after the app's own 3:00 dump:
#
#   0 4 * * * cd ~/loomkeep && ./docker/backup-offsite.sh >> /var/log/loomkeep-backup-offsite.log 2>&1
#
# Covers: loomkeep, unleash, glitchtip, umami (separate databases on the
# shared Postgres instance) and Quackback's own Postgres + MinIO uploads
# (a completely separate compose project, sibling checkout). Deliberately
# NOT covered (see docker/README.md "Backups"): Grafana/Loki/Prometheus,
# Portainer, Caddy's TLS certs.
#
# Every dump is age-encrypted (ASCII-armored) before it leaves this host,
# for BACKUP_ENCRYPTION_PUBLIC_KEY — same key as the in-app backup, only
# the public key is ever needed here. Uploaded to Cloudflare R2 via rclone;
# a 30-day lifecycle rule on the bucket handles retention.
#
# One-time setup this script assumes is already done (see docker/README.md
# "Offsite setup"): `age`/`rclone` installed, `rclone config` has a remote
# named $R2_REMOTE, the R2 bucket exists with its lifecycle rule, and both
# this checkout's .env and the Quackback sibling checkout's .env have their
# credentials set.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOOMKEEP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
QUACKBACK_DIR="${QUACKBACK_DIR:-$LOOMKEEP_DIR/../quackback}"

R2_REMOTE="${R2_REMOTE:-r2}"
R2_BUCKET="${R2_BUCKET:?set R2_BUCKET (the Cloudflare R2 bucket name)}"

set -a
# shellcheck disable=SC1091
source "$LOOMKEEP_DIR/.env"
set +a
: "${BACKUP_ENCRYPTION_PUBLIC_KEY:?set BACKUP_ENCRYPTION_PUBLIC_KEY in $LOOMKEEP_DIR/.env}"
: "${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in $LOOMKEEP_DIR/.env}"
POSTGRES_USER="${POSTGRES_USER:-loomkeep}"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
DATE="$(date -u +%Y-%m-%dT%H-%M-%SZ)"

# Dumps one database from a running Postgres container, straight through
# age — the plaintext dump only ever exists in a pipe, never on disk.
dump_pg() {
  local container="$1" user="$2" password="$3" db="$4" out="$5"
  docker exec -e PGPASSWORD="$password" "$container" \
    pg_dump -U "$user" -d "$db" --no-owner --no-privileges |
    age -r "$BACKUP_ENCRYPTION_PUBLIC_KEY" -a >"$WORKDIR/$out"
}

echo "[$DATE] Dumping loomkeep, unleash, glitchtip, umami (shared Postgres)…"
dump_pg db "$POSTGRES_USER" "$POSTGRES_PASSWORD" loomkeep "loomkeep-$DATE.sql.age"
dump_pg db "$POSTGRES_USER" "$POSTGRES_PASSWORD" unleash "unleash-$DATE.sql.age"
dump_pg db "$POSTGRES_USER" "$POSTGRES_PASSWORD" glitchtip "glitchtip-$DATE.sql.age"
dump_pg db "$POSTGRES_USER" "$POSTGRES_PASSWORD" umami "umami-$DATE.sql.age"

if [ -f "$QUACKBACK_DIR/.env" ]; then
  echo "[$DATE] Dumping Quackback (separate stack at $QUACKBACK_DIR)…"
  set -a
  # shellcheck disable=SC1091
  source "$QUACKBACK_DIR/.env"
  set +a
  : "${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in $QUACKBACK_DIR/.env}"
  dump_pg quackback-db "${POSTGRES_USER:-quackback}" "$POSTGRES_PASSWORD" \
    "${POSTGRES_DB:-quackback}" "quackback-$DATE.sql.age"

  # No host port on the MinIO bucket — tar the named volume directly.
  # Volume name is Compose's default "<project>_<volume>"; override
  # QUACKBACK_MINIO_VOLUME if the sibling checkout uses a non-default
  # COMPOSE_PROJECT_NAME.
  echo "[$DATE] Archiving Quackback's MinIO uploads…"
  docker run --rm -v "${QUACKBACK_MINIO_VOLUME:-quackback_minio_data}:/data:ro" \
    -w /data alpine tar czf - . |
    age -r "$BACKUP_ENCRYPTION_PUBLIC_KEY" >"$WORKDIR/quackback-uploads-$DATE.tar.gz.age"
else
  echo "[$DATE] No Quackback checkout at $QUACKBACK_DIR — skipping." >&2
fi

echo "[$DATE] Uploading to $R2_REMOTE:$R2_BUCKET/$DATE/…"
rclone copy "$WORKDIR" "$R2_REMOTE:$R2_BUCKET/$DATE/"

# Optional dead-man's-switch ping, silently skipped if unset.
if [ -n "${HEALTHCHECKS_OFFSITE_BACKUP_URL:-}" ]; then
  curl -fsS -m 10 "$HEALTHCHECKS_OFFSITE_BACKUP_URL" >/dev/null || true
fi

echo "[$DATE] Done."
