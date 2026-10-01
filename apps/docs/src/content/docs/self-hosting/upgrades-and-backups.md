---
title: Upgrades & backups
description: Keep your instance up to date, back it up, and restore it.
---

## Upgrading

From the repository's root:

```sh
git pull
docker compose pull
docker compose up -d
```

`git pull` brings the compose files and `.env.example` up to date;
`docker compose pull` fetches the new images. The API applies database
migrations on its own as it starts: nothing else to run.

Before upgrading, read the [changelog](https://feedback.loomkeep.app/changelog)
and the notes below: a few releases ask for a step of your own.

### Pinning a version

By default the images follow `latest`, the newest build of `main`. Every
build is also tagged with its short commit hash, so `IMAGE_TAG=<hash>` in
`.env`
holds your instance on that exact build until you change it.

### Notes needing action

- **Instance settings moved out of Unleash.** Social features, gamification,
  registration and the public API are now set in
  [Admin › Instance settings](/self-hosting/instance-settings/). Flags of the
  same names in Unleash are ignored. A variable in `.env` still wins: remove
  `SOCIAL_ENABLED` & co. from it to manage them from the page.

## Backups

Loomkeep backs its database up **every night at 3 a.m.** on its own, keeping
the last seven. Each dump is encrypted before it touches the disk, for a key only
you hold:

1. On **your own machine**, not the server, create a key pair with
   [age](https://age-encryption.org):

   ```sh
   age-keygen -o loomkeep-backup-key.txt
   ```

2. Copy the `age1…` public key it prints into `BACKUP_ENCRYPTION_PUBLIC_KEY`
   in `.env`.
3. Keep `loomkeep-backup-key.txt` somewhere safe and separate, like a
   password manager. **Without it, no backup can ever be read.**

**Admin › Backup** lists the backups, makes one on demand, downloads or
deletes them, and restores one, which replaces the whole database.

### Off the server

Backups kept on the server die with it. Copy them elsewhere regularly. The
repository's `docker/backup-offsite.sh` is the script the hosted instance
runs from cron to ship its encrypted dumps to Cloudflare R2 through rclone;
its header explains how to adapt it.

### Restoring

1. Decrypt the dump on your machine:

   ```sh
   age -d -i loomkeep-backup-key.txt -o dump.sql backup-file.sql.age
   ```

2. Restore it from **Admin › Backup**.

Try it once while nothing is wrong: a backup nobody has restored is a hope,
not a backup.

## Users' own exports

Each person can also take a full copy of their own data at any time: see
[Your data](/guide/your-data/).
