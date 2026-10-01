---
title: Conventions
description: Formats, pagination, sorting, languages and CORS, shared by every endpoint.
---

## Formats

- JSON in camelCase.
- Dates are ISO 8601 strings in UTC (`2026-10-01T12:00:00.000Z`).
- `url` fields link to the matching page of the Loomkeep web app.

## Pagination

Paginated endpoints take `page` (from 1) and `limit` (1 to 100, 20 by
default), and answer:

```json
{ "items": [], "hasMore": false, "total": 0 }
```

Keep asking for the next `page` while `hasMore` is true. Deep pages of a
cross-domain list cost more to build; to copy everything at once, use
[`GET /v1/export`](/api/reference/#tag/export) instead.

## Sorting

`GET /v1/library` sorts with `sort` (`added`, `title`, `rating` or
`finished`) and `order`. `desc`, the default, keeps each sort's natural
order: newest first, best rated first, A to Z for titles. `asc` reverses it.

## Languages

Film and series titles follow the account's language (Settings ›
Appearance), or `?lang=` (`en`, `fr`, `it`) on any endpoint that returns
works. A title nobody has opened in that language yet stays in English.
Anime keep their AniList title, and games, books and albums their
catalogue's single title. Any other `lang` is a `400`.

## CORS

The API accepts requests from any origin, without cookies: a key is the only
way in, so it can be called from a browser page as well as from a server.
Mind where the key ends up, though: see [Security](/api/security/).

## Errors and limits

Errors share one shape, described with every code in
[Errors](/api/errors/). Each account has a budget of requests per minute:
see [Rate limits](/api/rate-limits/).
