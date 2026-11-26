# @loomkeep/api

NestJS REST API for Loomkeep — Prisma/PostgreSQL persistence, JWT auth, and
the live catalogue providers (TMDB, AniList, IGDB, Open Library,
MusicBrainz). For the project as a whole (what Loomkeep is, self-hosting,
Docker), see [docs.loomkeep.app](https://docs.loomkeep.app). For architecture
decisions and dev conventions shared with the web app, see the root
[CLAUDE.md](../../CLAUDE.md).

## Stack

- **NestJS** on **Fastify** (`@nestjs/platform-fastify`), global prefix
  `/api`, global JWT guard (`@Public()` to opt out).
- **Prisma** + **PostgreSQL**, schema in `prisma/schema/`: one file per
  module that owns those tables (`users.prisma`, `games.prisma`…), and the
  generators, datasource and shared enums in `schema.prisma`. An `erd`
  generator (`prisma-erd-generator`) is configured alongside the client
  generator — run `pnpm exec prisma generate` to also emit an ERD diagram.
- **Auth**: access JWT (15 min) + rotating refresh tokens (one row per
  device, SHA-256 hashed).
- **`nestjs-pino`**: structured JSON logs, pretty-printed only in
  `NODE_ENV=development`. `Authorization`/`Cookie`/`Set-Cookie` redacted,
  request bodies never logged.
- **Sentry SDK** (`@sentry/node`, `src/instrument.ts`) reports 5xx
  exceptions to GlitchTip when `GLITCHTIP_API_DSN` is set — see
  [Error tracking](https://docs.loomkeep.app/self-hosting/optional-services/error-tracking/).
- **Swagger UI** on `/swagger`, dev-only (`NODE_ENV=development`) — the
  `@nestjs/swagger` import is dynamic so it's never bundled in production.

## Layout (`src/`)

One folder per NestJS module, named after what it owns: its controller,
services, DTOs and, for the tables it writes, its file in `prisma/schema/`.
Three folders are not domains:

- `common/` — infrastructure and pure helpers (HTTP, logging, CORS,
  pagination, errors). It imports no other module (`common-boundary.spec.ts`).
- `work/` — what the four domains (media, games, books, music) share: entry
  lifecycle, loans, bulk edits, work links, and `domain-parity.spec.ts`.
- `ee/` — premium features under LICENSE-EE, registered only by
  `app.module.ts`.

The decisions behind this shape are in [docs/adr/](../../docs/adr/README.md).

## Commands

Setting up the whole repository is in the
[contributing guide](https://docs.loomkeep.app/project/contributing/). This package's own:

```sh
pnpm --filter @loomkeep/api test           # unit tests, offline (HTTP calls are stubbed)
pnpm --filter @loomkeep/api test:e2e       # full API flow against the dev Postgres, isolated "e2e" schema
pnpm --filter @loomkeep/api exec prisma migrate dev --name <name>   # after editing prisma/schema/
pnpm --filter @loomkeep/api generate:openapi   # the public API's openapi-v1.json, after `build`
```

## Environment

`ConfigModule` reads `apps/api/.env` first, then the repo-root `.env` as a
fallback: the first file to define a key wins. `apps/api/.env.example` only
holds what must differ from the Docker deployment (`DATABASE_URL`,
`WEB_ORIGIN`, dev secrets); everything else lives once in the root
`.env.example`, documented for self-hosters in
[Configuration](https://docs.loomkeep.app/self-hosting/configuration/).
