# @loomkeep/web

SvelteKit PWA front-end for Loomkeep — talks to `@loomkeep/api` over HTTP,
ships no server-side logic of its own beyond serving the app and rendering
its public pages (see below). For the project as a whole (what
Loomkeep is, self-hosting, Docker), see [docs.loomkeep.app](https://docs.loomkeep.app).
For day-to-day dev conventions shared with the API, see the root
[CLAUDE.md](../../CLAUDE.md).

## Stack

- **SvelteKit** (Svelte 5, runes mode forced in `vite.config.ts`) + **adapter-node**
  — ships as a plain Node server, self-hostable in Docker.
- **Tailwind v4** (`@tailwindcss/vite`) for styling — see
  [DESIGN.md](DESIGN.md) for the "Séance" visual identity (palette,
  typography, component classes).
- **PWA**: SvelteKit's own service worker (`src/service-worker/`), which
  handles Web Push `push` and `notificationclick` events. It precaches
  nothing; the app registers it itself (`src/lib/native/service-worker.ts`)
  rather than letting SvelteKit do it.
- **`@tanstack/svelte-query`** for every API call, through the
  `createApiQuery`/`createApiMutation`/`createApiInfiniteQuery` helpers in
  `src/lib/api/` (see the root CLAUDE.md).
- **`@loomkeep/shared`** (workspace package) for DTOs/enums shared with the
  API — consumed from its built `dist/`, so `pnpm build:package` at the repo
  root after editing it.

The app under `/app` and the sign-in pages run client-side only
(`ssr = false` in their `+layout.ts`); the landing page and the legal pages
are rendered on the server at each request. Auth tokens live in `HttpOnly`
cookies, and the API base URL comes from
`PUBLIC_API_URL` (`$env/dynamic/public`, resolved at server start —
Docker-friendly, no rebuild needed to point at a different API host).

## Structure

```
src/
  routes/         # SvelteKit pages (file-based routing) — one folder per
                   # top-level feature: media, search, lists, reviews,
                   # feed, stats, admin, settings, auth flows, ...
  lib/             # sorted by domain, like the API's modules
    books/ games/ media/ music/   # one folder per domain: components,
    library/ lists/ reviews/ …    # stores and helpers together
    ui/            # generic components and helpers — check here (and any
                   # route-local components/ folder) before writing a new one
    shell/         # the app's frame: navigation, boot, config, feature flags
    api/           # request() wrappers per domain, talk to the NestJS API
    actions/       # Svelte actions (use:)
    native/        # bridge to the Android app's native plugins
    realtime/      # WebSocket client
    types/         # front-end-only types (DTOs come from @loomkeep/shared)
    assets/
  service-worker/  # service worker source (Web Push, notification clicks)
  app.css          # Tailwind tokens (light/dark theme variables)
```

## Commands

Setting up the whole repository is in the
[contributing guide](https://docs.loomkeep.app/project/contributing/). This package's own:

```sh
pnpm --filter @loomkeep/web exec vitest --project unit        # plain *.spec.ts, in Node
pnpm --filter @loomkeep/web exec vitest --project component   # *.svelte.spec.ts, in happy-dom
pnpm --filter @loomkeep/web generate:paraglide                # after editing messages/
pnpm --filter @loomkeep/web generate:api-types                # after the API's OpenAPI document changes
```

## Environment

`PUBLIC_API_URL` and the optional `PUBLIC_*` keys (GlitchTip, Umami,
Turnstile, Unleash, Simkl…) are read through `$env/dynamic/public`, at server start:
see [Configuration](https://docs.loomkeep.app/self-hosting/configuration/).
