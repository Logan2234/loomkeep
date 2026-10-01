---
title: Feature flags
description: Unleash, for per-domain maintenance and a site-wide news banner.
sidebar:
  order: 4
---

[Unleash](https://www.getunleash.io) switches things on and off at runtime,
without a redeploy. On Loomkeep it serves two things:

- **Maintenance per domain**: a `MAINTENANCE_MEDIA` flag (or `_GAMES`,
  `_BOOKS`, `_MUSIC`) takes that domain offline for everyone, live, while the
  rest keeps working.
- **A news banner** across the top of the site, from the `NEWS_BANNER` flag:
  a scheduled maintenance, degraded service, or a message of your own. Its
  payload format is in the repository's `docker/README.md`.

Permanent choices aren't flags: they live in
[instance settings](/self-hosting/instance-settings/).

## Enabling it

1. Set `UNLEASH_ADMIN_PASSWORD`, `UNLEASH_API_TOKEN` and
   `PUBLIC_UNLEASH_FRONTEND_TOKEN` in `.env` (their format is in
   `.env.example`).
2. Add `docker/docker-compose.unleash.yml` to `COMPOSE_FILE` in `.env`, then:

```sh
docker compose pull
docker compose up -d
```

3. At `flags.<DOMAIN>`, sign in and change the default password.
4. In **Admin settings › Access control › CORS origins**, allow your
   instance's address: the web app reads flags straight from the browser.

To take the **whole** site down instead, without Unleash, create the file
`docker/caddy-flags/maintenance` on the server; delete it to come back.
