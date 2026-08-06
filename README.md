# Loomkeep

[![CI](https://github.com/Logan2234/tracklore/actions/workflows/ci.yml/badge.svg)](https://github.com/Logan2234/tracklore/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Logan2234/tracklore/graph/badge.svg)](https://codecov.io/gh/Logan2234/tracklore)

Self-hosted tracker for **series, movies and anime** — with games, books and
more planned. Built as a TV Time replacement you fully own: your data lives in
your own PostgreSQL, catalogues come live from [TMDB](https://www.themoviedb.org/)
(movies & series) and [AniList](https://anilist.co/) (anime).

## Stack

- **Monorepo** pnpm workspaces, 100% TypeScript
- `apps/api` — NestJS + Prisma + PostgreSQL (JWT auth, rotating refresh tokens)
- `apps/web` — SvelteKit PWA (installable, dark UI), talks to the API
- `packages/shared` — DTOs/enums shared between front and back

Key design choice: the database is an **on-demand cache**. Searching queries
TMDB/AniList live; a media is persisted (with its seasons, episodes and
external IDs — TMDB/AniList/TVDB/IMDB) only when a user tracks it. Episode
watches are stored **one row per viewing**, so rewatches are first-class.

## Self-hosting (Docker)

```sh
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, both JWT secrets and TMDB_API_TOKEN.
docker compose up -d --build
```

Then open http://localhost:8080 (or `WEB_PORT`), create an account, done.
On a NAS, set `PUBLIC_API_URL` and `WEB_ORIGIN` to the host's address
(e.g. `http://nas.local:3000/api` and `http://nas.local:8080`).

Upgrades: `git pull && docker compose up -d --build` — database migrations
run automatically when the API boots.

### TMDB API key

Create a free account on themoviedb.org, then copy the **API Read Access
Token (v4)** from Settings → API into `TMDB_API_TOKEN`. Anime search (AniList)
works without any key.

### Email (SMTP)

Password reset, email verification, account change confirmations and email
alerts for new episodes all go through `SMTP_*` in `.env`. Empty = email is
silently disabled, everything else still works (the reset-password flow just
has no way to reach you).

[Brevo](https://www.brevo.com) has a free SMTP relay (300 emails/day, no
credit card): create an account (personal accounts are fine, no company or
website required), then **SMTP & API** in the sidebar for `SMTP_HOST`,
`SMTP_USER` and `SMTP_PASS`.

### Mobile access (ngrok)

Install it as a PWA on your phone while the stack keeps running on your
computer, reachable from anywhere. A public HTTPS URL is required (the service
worker and Web Push refuse plain HTTP on a real device); [ngrok](https://ngrok.com)
provides one by tunnelling to the local proxy. Your computer must stay on.

1. Create a free ngrok account, then claim your **one free static domain** at
   <https://dashboard.ngrok.com/domains> (a stable URL is required for an
   installed PWA). Copy `ngrok.example.yml` to `ngrok.yml` and fill in your
   authtoken + domain.
2. Set that domain **once** in `.env` — the override derives `PUBLIC_API_URL`,
   `WEB_ORIGIN` and the ngrok header from it:

   ```sh
   NGROK_DOMAIN=your-domain.ngrok-free.app
   ```

3. Start the stack with the ngrok override, then the tunnel:

   ```sh
   docker compose -f docker-compose.yml -f docker-compose.ngrok.yml up -d --build
   ngrok start loomkeep
   ```

4. Open the domain on your phone → browser menu → _Add to home screen_.

On ngrok's free tier the first page load shows a one-time warning page you
click through; API calls skip it via `PUBLIC_NGROK`. For daily use by more than
one person, host the app publicly instead (VPS or a PaaS).

### Public hosting (VPS)

For a stack that's always up under your own domain (e.g. an OVH VPS), use the
`docker-compose.prod.yml` override instead of the ngrok one. It adds the same
single-origin Caddy proxy, but Caddy requests and renews a real Let's Encrypt
certificate itself and serves HTTPS on the standard ports — no tunnel, no
warning page.

1. Point the domain's **A** (and **AAAA** if you have IPv6) record at the
   VPS's public IP, and make sure ports **80** and **443** are open on the
   VPS firewall (80 is required for the Let's Encrypt HTTP challenge, and
   Caddy redirects it to 443).
2. Set the domain once in `.env` — the override derives `PUBLIC_API_URL`,
   `WEB_ORIGIN` and Caddy's `SITE_ADDRESS` from it:

   ```sh
   DOMAIN=loomkeep.app
   ```

3. Start the stack with the prod override:

   ```sh
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```

4. Open `https://<DOMAIN>` — the first request can take a few seconds while
   Caddy obtains the certificate. Check `docker compose logs caddy` if it
   doesn't come up (common causes: DNS not yet propagated, or port 80/443
   blocked by the VPS provider's firewall in addition to the OS one — OVH
   VPS also has a network firewall in the control panel that must allow
   80/443 separately from any `ufw`/`iptables` rules on the box).

## Development

```sh
pnpm install
docker run -d --name loomkeep-dev-db -e POSTGRES_USER=loomkeep \
  -e POSTGRES_PASSWORD=loomkeep -e POSTGRES_DB=loomkeep \
  -p 5433:5432 postgres:17-alpine
cp apps/api/.env.example apps/api/.env   # then add your TMDB token
pnpm --filter @loomkeep/api exec prisma migrate dev
pnpm --filter @loomkeep/shared build
pnpm dev        # api on :3000, web on :5173
```

Tests:

```sh
pnpm --filter @loomkeep/api test        # unit (provider mapping)
pnpm --filter @loomkeep/api test:e2e    # full API flow, isolated "e2e" schema
```

## Roadmap

- **P1 — MVP** ✓: auth, search, tracking, episode progress, PWA, Docker
- **P1.5 — TV Time import** ✓: interactive reconciliation (analyze → review
  collection by collection → commit), matched through TVDB IDs, with manual
  overrides. Source-agnostic pipeline, ready for more import sources.
- **P2** — push notifications ("new episode out") + Capacitor.
  In-app notifications, a periodic scan/refresh of tracked shows and **Web Push**
  (VAPID, service-worker `push` handler, per-device subscriptions) are shipped ✓.
  **Email** is shipped ✓: password reset, email verification, account change
  confirmations and (opt-in) new-episode alerts, via SMTP — see "Email" above.
  **Mobile access** is shipped ✓: the app installs as a PWA, and a ready-made
  ngrok setup (single-origin Caddy proxy) exposes the local stack to your phone
  from anywhere — see "Mobile access" above. The native (Capacitor) wrapper is
  still to do.
- **P3** (current) — games & books modules: games (IGDB, library + statuses +
  playtime + Steam import) and books (Google Books/Open Library, library +
  reading progress + StoryGraph import) are built, with per-domain stats and
  community ratings. A unified global search covers all three domains, and
  `enabledDomains` is enforced server-side on search/stats and filters
  notifications. Manual match-correction is available on Steam and
  StoryGraph imports. Remaining: more import sources (Goodreads, Babelio,
  Backloggd), e2e coverage for games/books.
- **P4** — social (friends, activity feed, shared lists)
- **P5** — hosted offer / entitlements (open core)

## License

AGPL-3.0 — self-host freely; run it as a service, share your changes.
