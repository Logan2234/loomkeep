---
title: Troubleshooting
description: Common problems running your own instance, and what to send when asking for help.
---

## First look

```sh
docker compose ps              # which services run, and their health
docker compose logs api        # the API's logs, the usual first stop
docker compose logs web
docker compose logs caddy      # with the HTTPS override
```

`https://<your-instance>/api/config` shows the version and build the
instance runs.

## Common problems

**`docker compose` refuses to start: "set … in .env".** A required variable
is empty: see [Configuration](/self-hosting/configuration/#required).

**The API stops right after starting: "Missing required environment
variable".** Same cause, named in the message. With the HTTPS override,
`MFA_ENCRYPTION_KEY` is required too.

**No certificate, the domain doesn't answer over HTTPS.** Check that DNS
points at the server (`dig +short <domain>`) and that ports 80 and 443 are
open, in the provider's firewall as well as the server's.
`docker compose logs caddy` names the failure.

**The app loads but every action fails, or CORS errors in the browser.**
`WEB_ORIGIN` must be exactly the address in the browser's bar, scheme and
port included, and `PUBLIC_API_URL` the API's address as the browser
reaches it. Both are set for you with the HTTPS override.

**No Admin menu.** `ADMIN_EMAIL` must match your account's email; sign out
and back in after setting it. In production, Admin also requires
[two-factor authentication](/self-hosting/administration/#becoming-administrator).

**Games search finds nothing.** IGDB needs `TWITCH_CLIENT_ID` and
`TWITCH_CLIENT_SECRET`: see [Catalogue keys](/self-hosting/catalogues/).

**An import is greyed out.** Its key is missing: Steam needs
`STEAM_API_KEY`, Simkl its own app.

**No emails.** Check the `SMTP_*` variables, then send a test from
**Admin › Communications**; the API's logs show the SMTP error.

**No push notifications.** They need HTTPS and the `VAPID_*` keys, and on
iPhone the app [installed](/guide/install/) on the home screen.

**A setting is greyed out in Admin › Instance settings.** A variable of the
same name is set in `.env`, and it wins: see
[Instance settings](/self-hosting/instance-settings/).

## Asking for help

Problems running or deploying an instance go to a
[GitHub issue](https://github.com/Logan2234/loomkeep/issues/new/choose)
("Self-hosting / deployment bug"). Bugs in the app itself go to the
[bug reports board](https://feedback.loomkeep.app/board/bug-reports).

Include:

- **the version**: from `/api/config`, or `git rev-parse --short HEAD`;
- **your `COMPOSE_FILE` line**, so the overrides you run are known;
- **the relevant logs** (`docker compose logs api` / `web`), **secrets
  removed** first;
- what you expected, what happened, and how to reproduce it.

Found a security issue? Don't open a public issue: follow the
[security policy](https://github.com/Logan2234/loomkeep/security/policy).
