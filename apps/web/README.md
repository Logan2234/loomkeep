# @loomkeep/web

SvelteKit PWA front-end for Loomkeep — talks to `@loomkeep/api` over HTTP,
ships no server-side logic of its own beyond serving the app
(`export const ssr = false`, see below). For the project as a whole (what
Loomkeep is, self-hosting, Docker), see the [root README](../../README.md).
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
- **`@tanstack/svelte-query`** for data fetching/caching where a mutation
  needs to invalidate data shown in more than one component (see
  `CommentThread.svelte` for the reference usage) — most of the app still
  calls the `src/lib/api/*` request wrappers directly from a component's own
  `$effect`/`$state`.
- **`@loomkeep/shared`** (workspace package) for DTOs/enums shared with the
  API — consumed from its built `dist/`, so `pnpm build:package` at the repo
  root after editing it.

No server-side rendering: the app runs as a pure SPA (`+layout.ts`), auth
tokens live in `localStorage`, and the API base URL comes from
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

```sh
pnpm --filter @loomkeep/web dev        # dev server on :5173 (run `pnpm dev` at
                                        # the repo root to start api + web together)
pnpm --filter @loomkeep/web build      # production build (adapter-node output)
pnpm --filter @loomkeep/web preview    # serve the production build locally
pnpm --filter @loomkeep/web check      # svelte-check — type errors in .svelte files
pnpm --filter @loomkeep/web lint       # eslint (formatting is a lint rule, see root CLAUDE.md)
pnpm --filter @loomkeep/web lint:fix   # eslint --fix
pnpm --filter @loomkeep/web clean      # removes build/
pnpm --filter @loomkeep/web clean:dev  # clean + removes node_modules and .svelte-kit
```

There is currently no automated test suite for this app (no `*.spec.ts`
under `src/`) — `check` (type-checking) and `lint` are the only gates;
end-to-end coverage lives in `@loomkeep/api`'s `test:e2e`, which drives the
API directly rather than through the UI.

(`prepare` — `svelte-kit sync` — runs automatically on `pnpm install`; no
need to call it directly.)

## Environment

`PUBLIC_API_URL` and `PUBLIC_GLITCHTIP_WEB_DSN` (optional, error reporting)
are the only env vars this app reads, both via `$env/dynamic/public`. See
the root `.env.example` for the full list used across the Docker stack.
