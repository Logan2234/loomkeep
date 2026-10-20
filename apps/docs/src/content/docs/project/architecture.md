---
title: Architecture
description: How Loomkeep is built, from the catalogues to the browser.
---

```
 Browser (PWA) ──► web (SvelteKit) ──► api (NestJS) ──► PostgreSQL
                                        │
                                        ├──► TMDB, AniList, IGDB, Open Library, MusicBrainz
                                        └──► SMTP, Web Push
```

## The pieces

- **`apps/api`**: a [NestJS](https://nestjs.com) API on Fastify, with
  [Prisma](https://www.prisma.io) and PostgreSQL. It serves the web app's
  internal routes and the versioned [public API](/api/) under `/api/v1`, and
  runs the scheduled jobs.
- **`apps/web`**: a [SvelteKit](https://svelte.dev) app, installable as a
  PWA. The public pages are prerendered; everything under `/app` runs in the
  browser and talks to the API.
- **`packages/shared`**: the types and enums both sides share, so a change
  in the API's shapes breaks the build rather than the app.
- **`apps/docs`**: this site, [Astro Starlight](https://starlight.astro.build)
  for the guides and [Scalar](https://scalar.com) for the API reference,
  rendered from the API's own OpenAPI document.

## Catalogues as an on-demand cache

Loomkeep doesn't mirror any catalogue. Search queries them live; a title is
copied into the database, with its seasons, episodes and ids in other
catalogues, only once someone tracks it. It is refreshed when it gets old,
and its episodes are never deleted, so a viewing always keeps its target.
Each domain has one catalogue: TMDB for films and series, AniList for anime,
IGDB for games, Open Library for books, MusicBrainz for music.

## History as rows

Every viewing is a row: watching an episode twice is two rows, a film's
rewatch is one more. Games and books group dated sessions into playthroughs
and readings. That is what lets history, stats and rewatches be exact
rather than estimated.

## Authentication

Sessions live in encrypted, `HttpOnly`, `SameSite=Strict` cookies, never in
browser storage, with short-lived access tokens and rotating refresh tokens,
one per device. Two-factor authentication (authenticator app, email codes,
security keys and passkeys) sits on top. The public API instead takes
personal API keys, only on its own routes. See
[Account security](/guide/security/) and [Authentication](/api/authentication/).

## Errors and languages

The API answers errors with stable codes (`auth.invalid_api_key`), never
with sentences: the web app turns each code into text in the reader's
language. The interface is English first, with French and Italian, all
through translation catalogs.

## Configuration

Permanent choices for an instance (social features, registration, the
public API) are [instance settings](/self-hosting/instance-settings/), stored
in the database. Temporary switches (maintenance of a domain, a news banner)
are feature flags in [Unleash](/self-hosting/optional-services/feature-flags/),
read live without a reload.

## Open core

A few premium features live in `ee/` directories under their own license;
the core never depends on them. See [License](/project/license/).

The detailed guide, with every convention, is
[`CLAUDE.md`](https://github.com/Logan2234/loomkeep/blob/main/CLAUDE.md) at
the repository's root.
