---
title: Error tracking
description: GlitchTip, a self-hosted, Sentry-compatible error tracker.
sidebar:
  order: 2
---

[GlitchTip](https://glitchtip.com) groups errors into issues with an
occurrence count, and can email you when a new kind of error first appears.
It runs at `errors.<DOMAIN>`, behind its own login; the first visitor sets up
the organisation.

1. Set `GLITCHTIP_SECRET_KEY` in `.env` to a long random string.
2. Add `docker/docker-compose.glitchtip.yml` to `COMPOSE_FILE` in `.env`, then:

```sh
docker compose pull
docker compose up -d
```

3. In GlitchTip, create two projects, **Node** for the API and
   **JavaScript** for the web app, and copy their DSNs into
   `GLITCHTIP_API_DSN` and `PUBLIC_GLITCHTIP_WEB_DSN`. Restart again.

Loomkeep then reports errors only: no performance tracing, no session
replay. For GlitchTip's own alert emails, set `GLITCHTIP_EMAIL_URL` (its
format is in `.env.example`).
