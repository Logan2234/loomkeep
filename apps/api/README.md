# @loomkeep/api

NestJS REST API for Loomkeep — Prisma/PostgreSQL persistence, JWT auth, and
the live catalogue providers (TMDB, AniList, IGDB, Google Books,
MusicBrainz). For the project as a whole (what Loomkeep is, self-hosting,
Docker), see the [root README](../../README.md). For architecture
decisions and dev conventions shared with the web app, see the root
[CLAUDE.md](../../CLAUDE.md).

## Stack

- **NestJS** on **Fastify** (`@nestjs/platform-fastify`), global prefix
  `/api`, global JWT guard (`@Public()` to opt out).
- **Prisma** + **PostgreSQL**, schema in `prisma/schema.prisma`. An `erd`
  generator (`prisma-erd-generator`) is configured alongside the client
  generator — run `pnpm exec prisma generate` to also emit an ERD diagram.
- **Auth**: access JWT (15 min) + rotating refresh tokens (one row per
  device, SHA-256 hashed).
- **`nestjs-pino`**: structured JSON logs, pretty-printed only in
  `NODE_ENV=development`. `Authorization`/`Cookie`/`Set-Cookie` redacted,
  request bodies never logged.
- **Sentry SDK** (`@sentry/node`, `src/instrument.ts`) reports 5xx
  exceptions to GlitchTip when `GLITCHTIP_API_DSN` is set — see the
  [Docker README](../../docker/README.md).
- **Swagger UI** on `/docs`, dev-only (`NODE_ENV=development`) — the
  `@nestjs/swagger` import is dynamic so it's never bundled in production.

## Modules (`src/`)

Domain modules, one per bounded concern:

- `catalog/` — the `CatalogProvider` interface + TMDB/AniList/IGDB/Google
  Books/MusicBrainz providers, and `MediaItemService.upsertFromSource()`
  (the single entry point that persists a catalogue item on-demand).
- `library/` — a user's tracked items, watch/read/listen progress.
- `import/` — interactive import pipelines (TV Time, Steam, StoryGraph),
  one `sources/<name>/` folder each behind a shared analyze → review →
  commit flow.
- `reviews/`, `comments/`, `social/`, `reports/` — the social feature set,
  gated behind `SOCIAL_ENABLED` (see
  [social/README.md](src/social/README.md) for the full design).
- `lists/` — user-curated, optionally shared collections.
- `notifications/`, `jobs/` — in-app notifications, Web Push, and the
  scheduled jobs (`@nestjs/schedule`) that scan tracked shows for new
  episodes. `JobRunService` records every run for the admin "Jobs" page and
  optionally pings Healthchecks.io per job — see the [Docker README](../../docker/README.md#job-monitoring-healthchecksio).
- `stats/` — per-domain and admin aggregate statistics.
- `admin/` — moderation queue, ops summaries.
- `auth/`, `users/`, `security/` — auth flows, account management,
  login-failure tracking.
- `mail/` — SMTP sending (password reset, verification, alerts) via
  `nodemailer`; silently disabled when `SMTP_*` is unset.
- `health/` — `/health` endpoint used by Docker healthchecks and the
  Homepage dashboard widget.
- `common/`, `config/` — cross-cutting utilities and env/config loading.

## Commands

```sh
pnpm --filter @loomkeep/api dev            # watch mode, :3000 (run `pnpm dev`
                                            # at the repo root to start api + web together)
pnpm --filter @loomkeep/api start          # like dev but without --watch
pnpm --filter @loomkeep/api build          # nest build → dist/
pnpm --filter @loomkeep/api start:prod     # node dist/main (production)

pnpm --filter @loomkeep/api lint           # eslint (formatting is a lint rule, see root CLAUDE.md)
pnpm --filter @loomkeep/api lint:fix       # eslint --fix

pnpm --filter @loomkeep/api test           # unit tests (jest, provider mapping etc.)
pnpm --filter @loomkeep/api test:cov       # unit tests with coverage
pnpm --filter @loomkeep/api test:e2e       # full API flow; needs the dev Postgres running,
                                            # runs in an isolated "e2e" schema

pnpm --filter @loomkeep/api exec prisma migrate dev --name <name>   # after editing schema.prisma
pnpm --filter @loomkeep/api spelunk        # visualize this package's module dependency graph
                                            # as Mermaid (writes ../../docs/modules.md at the
                                            # repo root) — `graph` runs the same script
pnpm --filter @loomkeep/api clean          # removes dist/ and tsconfig.build.tsbuildinfo
pnpm --filter @loomkeep/api clean:dev      # clean + removes node_modules
```

Unit tests stub all HTTP calls, so they run offline; `TMDB_API_TOKEN` empty
only affects runtime search, not tests.

## Environment

`ConfigModule` reads two files, in order (`src/app.module.ts`):
`apps/api/.env` first, then the repo-root `.env` as a fallback — the first
file to define a given key wins. So for local dev, copy **both**
`.env.example` files:

```sh
cp .env.example .env                 # repo root — provider API keys, SMTP, ADMIN_EMAIL, ...
cp apps/api/.env.example apps/api/.env   # this folder — DATABASE_URL, WEB_ORIGIN, dev JWT secrets, TLS certs
```

`apps/api/.env.example` only holds values that must differ from the Docker
deployment; everything else lives once in the root `.env.example` (also
consumed by `docker-compose.yml`'s interpolation) instead of being
duplicated in both files.

The dev database is a standalone Postgres container (`loomkeep-dev-db`, port
**5433**) — see the root README's "Development" section to start one.
