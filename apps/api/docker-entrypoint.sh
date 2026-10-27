#!/bin/sh
# Starts as root only to hand the backup volume to `node`, then drops to it
# for the migration and the API. A volume created when the image still ran
# as root belongs to root: without this, the first nightly backup after an
# upgrade would fail to write.
set -e

if [ "$(id -u)" = 0 ]; then
  backup_dir="${BACKUP_DIR:-/data/backups}"
  mkdir -p "$backup_dir"
  chown -R node:node "$backup_dir"
  exec su-exec node "$@"
fi

exec "$@"
