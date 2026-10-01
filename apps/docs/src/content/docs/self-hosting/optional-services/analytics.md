---
title: Analytics
description: Umami, cookie-less statistics for the public landing page.
sidebar:
  order: 3
---

[Umami](https://umami.is) counts visits to the public landing page: page
views, referrers and clicks on its main buttons. It is cookie-less and keeps
no visitor ID, and never tracks anything inside the app (`/app`).

1. Set `UMAMI_APP_SECRET` in `.env` (`openssl rand -hex 32`).
2. Add `docker/docker-compose.umami.yml` to `COMPOSE_FILE` in `.env`, then:

```sh
docker compose pull
docker compose up -d
```

3. Open `stats.<DOMAIN>` and sign in with Umami's default account
   (`admin` / `umami`): **change its password straight away**.
4. In **Settings › Websites**, add your site, then set
   `PUBLIC_UMAMI_WEBSITE_ID` (the id shown there) and
   `PUBLIC_UMAMI_SCRIPT_URL` (`https://stats.<DOMAIN>/loomkeep.js`). Restart.

The tracking script and endpoint are renamed, so generic ad-blocker lists
don't drop a cookie-less counter by name.
