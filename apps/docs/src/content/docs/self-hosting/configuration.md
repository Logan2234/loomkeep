---
title: Configuration
description: Every environment variable of the core setup, what it does and whether you need it.
---

Loomkeep reads its configuration from `.env` at the repository's root. After
a change, apply it with `docker compose up -d`. `.env.example` lists every
variable with its own comments; optional services have theirs on
[their pages](/self-hosting/optional-services/).

## Required

| Variable                                            | What it is                                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | The database's credentials.                                                                                                                                               |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`           | Sign sessions. Changing either signs everyone out.                                                                                                                        |
| `MFA_ENCRYPTION_KEY`                                | Encrypts authenticator-app secrets. Required with the HTTPS override. **Never change it** once someone uses an authenticator app: their second factor would stop working. |
| `BACKUP_ENCRYPTION_PUBLIC_KEY`                      | The [age](https://age-encryption.org) public key backups are encrypted for.                                                                                               |
| `TMDB_API_TOKEN`                                    | Films and series: see [Catalogue keys](/self-hosting/catalogues/).                                                                                                        |

## Addresses

| Variable         | Default                     | What it is                                                       |
| ---------------- | --------------------------- | ---------------------------------------------------------------- |
| `PUBLIC_API_URL` | `http://localhost:3000/api` | Where browsers reach the API.                                    |
| `WEB_ORIGIN`     | `http://localhost:8080`     | Where the web app is served; also the origin the API accepts.    |
| `DOMAIN`         | —                           | With the HTTPS override: your domain. Sets both addresses above. |
| `COMPOSE_FILE`   | —                           | The compose files to combine, separated by colons.               |

## Accounts and instance

| Variable                                                                                                                                | What it is                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `ADMIN_EMAIL`                                                                                                                           | The account with this email becomes administrator when it signs up or in.                       |
| `SOCIAL_ENABLED`, `GAMIFICATION_ENABLED`, `REGISTRATION_ENABLED`, `PUBLIC_API_ENABLED`, `API_RATE_LIMIT_FREE`, `API_RATE_LIMIT_PREMIUM` | Optional: override and lock the matching [instance settings](/self-hosting/instance-settings/). |
| `LOOMKEEP_LICENSE_KEY`                                                                                                                  | Not needed for now: see [Premium edition](/self-hosting/premium/).                              |

## Catalogues and imports

`TMDB_API_TOKEN`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `OMDB_API_KEY`,
`STEAM_API_KEY`, `SIMKL_CLIENT_ID`, `SIMKL_CLIENT_SECRET` and `API_CONTACT`:
see [Catalogue keys](/self-hosting/catalogues/).

## Email and push

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `MAIL_SUPPORT_ADDRESS`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`: see
[Email and push](/self-hosting/email-and-push/).

## Security and logs

| Variable                                            | What it is                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Optional bot protection on sign-up: see [Behind Cloudflare](/self-hosting/cloudflare/#turnstile-on-sign-up). |
| `LOG_LEVEL`                                         | `fatal`, `error`, `warn`, `info` (default), `debug`, `trace` or `silent`.                                    |
| `IMAGE_TAG`                                         | Pins the images to a release instead of `latest`: see [Upgrades](/self-hosting/upgrades-and-backups/).       |

:::tip
Empty optional variables simply turn their feature off: an import without
its key is greyed out, email without SMTP is skipped, and so on. Nothing
else breaks.
:::
