# @loomkeep/web

SvelteKit PWA front-end for Loomkeep — talks to `@loomkeep/api` over HTTP,
ships no server-side logic of its own beyond serving the app
(`export const ssr = false`, see below). For the project as a whole (what
Loomkeep is, self-hosting, Docker), see [docs.loomkeep.app](https://docs.loomkeep.app).
For day-to-day dev conventions shared with the API, see the root
[CLAUDE.md](../../CLAUDE.md).

## Stack

- **SvelteKit** (Svelte 5, runes mode forced in `vite.config.ts`) + **adapter-node**
  — ships as a plain Node server, self-hostable in Docker.
- **Tailwind v4** (`@tailwindcss/vite`) for styling — see
  [DESIGN.md](DESIGN.md) for the "Séance" visual identity (palette,
  typography, component classes).
- **PWA**: `@vite-pwa/sveltekit` with a custom service worker (`src/sw.ts`,
  `injectManifest` strategy) so Web Push `push` events can be handled
  alongside offline app-shell precaching.
- **`@tanstack/svelte-query`** for every API call, through the
  `createApiQuery`/`createApiMutation`/`createApiInfiniteQuery` helpers in
  `src/lib/api/` (see the root CLAUDE.md).
- **`@loomkeep/shared`** (workspace package) for DTOs/enums shared with the
  API — consumed from its built `dist/`, so `pnpm build:package` at the repo
  root after editing it.

No server-side rendering: the app runs as a pure SPA (`+layout.ts`), auth
tokens live in `HttpOnly` cookies, and the API base URL comes from
`PUBLIC_API_URL` (`$env/dynamic/public`, resolved at server start —
Docker-friendly, no rebuild needed to point at a different API host).

## Structure

```
src/
  routes/         # SvelteKit pages (file-based routing) — one folder per
                   # top-level feature: media, search, lists, reviews,
                   # feed, stats, admin, settings, auth flows, ...
  lib/
    api/           # request() wrappers per domain, talk to the NestJS API
    components/    # shared Svelte components — check here (and any
                   # route-local components/ folder) before writing a new one
    actions/       # Svelte actions (use:)
    import/        # import-flow UI (TV Time, Steam, StoryGraph, ...)
    types/         # front-end-only types (DTOs come from @loomkeep/shared)
    assets/
    auth.svelte.ts    # auth state (Svelte 5 runes)
    queryClient.ts    # svelte-query client/provider
  sw.ts            # custom service worker source (Web Push + precaching)
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
