---
title: Nightly backup
description: Save a full export of your account every night, and keep the last thirty.
sidebar:
  order: 3
---

`GET /v1/export` returns everything your account holds, in the same format
as **Settings › Export**. Saved every night, it is a backup you control.

**Key:** `export:read`. The export runs **once an hour** at most.

1. Create the key in **Settings › Integrations**, and save this script as
   `~/bin/loomkeep-backup.sh`:

   ```sh
   #!/bin/sh
   set -eu

   dir="$HOME/backups/loomkeep"
   mkdir -p "$dir"

   curl --fail --silent --show-error \
     -H "Authorization: Bearer $LOOMKEEP_API_KEY" \
     -o "$dir/loomkeep-$(date +%F).json" \
     https://loomkeep.app/api/v1/export

   # Keep the last thirty.
   find "$dir" -name 'loomkeep-*.json' -mtime +30 -delete
   ```

2. Make it executable (`chmod +x ~/bin/loomkeep-backup.sh`), then run it
   every night at 3 with `crontab -e`:

   ```
   LOOMKEEP_API_KEY=lk_…
   0 3 * * * $HOME/bin/loomkeep-backup.sh
   ```

`--fail` makes curl exit with an error on a `4xx` or `5xx`, so cron mails you
when a backup fails instead of saving an error as your backup.

## Reading it

The export is plain JSON: open it in any editor, or query it with a tool like
[jq](https://jqlang.org), for instance every film you rated 10:

```sh
jq '.library[] | select(.rating == 10) | .media.title' loomkeep-2026-10-01.json
```
