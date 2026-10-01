---
title: Homepage widget
description: Show your Loomkeep stats on a Homepage dashboard.
sidebar:
  order: 1
---

[Homepage](https://gethomepage.dev) shows any JSON API through its
`customapi` widget. This one shows what you track and how far along you are.

**Key:** `stats:read`.

1. Create the key in **Settings › Integrations**, then give it to Homepage as
   an environment variable, so it stays out of your configuration files:

   ```sh
   HOMEPAGE_VAR_LOOMKEEP_API_KEY=lk_…
   ```

2. Add the service to `services.yaml`:

   ```yaml
   - Media:
       - Loomkeep:
           href: https://loomkeep.app
           description: What I watch, play, read and listen to
           icon: https://loomkeep.app/favicon.svg
           widget:
             type: customapi
             url: https://loomkeep.app/api/v1/stats/summary
             refreshInterval: 900000 # 15 minutes
             headers:
               Authorization: "Bearer {{HOMEPAGE_VAR_LOOMKEEP_API_KEY}}"
             mappings:
               - field: total
                 label: Tracked
                 format: number
               - field: video.episodesWatched
                 label: Episodes
                 format: number
               - field: books.pagesRead
                 label: Pages read
                 format: number
               - field: favorites
                 label: Favourites
                 format: number
   ```

On a self-hosted instance, replace `https://loomkeep.app` with your own
address. If Homepage runs next to Loomkeep in the same Docker network, it can
call the API directly (`http://api:3000/api/v1/…`).

## Variations

- **Reading goal:** `books.readingGoal.completed` and
  `books.readingGoal.target`.
- **Time spent, in minutes:** `video.totalMinutes` or
  `games.totalPlaytimeMinutes`.

Every field is listed under `GET /v1/stats/summary` in the
[reference](/api/reference/#tag/stats).
