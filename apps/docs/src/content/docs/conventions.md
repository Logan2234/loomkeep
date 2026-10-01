---
title: Conventions
description: Formats, pagination, statuses, errors and rate limits shared by every endpoint.
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

## Statuses

Each domain has its own statuses (`WATCHING`, `PLAYING`, `TO_READ`,
`LISTENED`…). Library entries keep that `status` and add a `phase`, the same
across domains, which is also what `?phase=` filters on:

| Phase         | Video                     | Games       | Books     | Music       |
| ------------- | ------------------------- | ----------- | --------- | ----------- |
| `PLANNED`     | `PLANNED`                 | `BACKLOG`   | `TO_READ` | `TO_LISTEN` |
| `IN_PROGRESS` | `WATCHING`                | `PLAYING`   | `READING` | —           |
| `DONE`        | `COMPLETED`, `UP_TO_DATE` | `COMPLETED` | `READ`    | `LISTENED`  |
| `DROPPED`     | `DROPPED`                 | `DROPPED`   | `DROPPED` | —           |

## Languages

Film and series titles follow the account's language (Settings › Appearance),
or `?lang=` (`en`, `fr`, `it`) on any endpoint that returns works. A title
nobody has opened in that language yet stays in English. Anime keep their
AniList title, and games, books and albums their catalogue's single title.
Any other `lang` is a `400`.

## History

`GET /v1/history` lists what happened, newest first: episodes and films seen,
game and reading sessions, games, books and albums finished. `from` and `to`
narrow it to a window: `to=2026-09-30` includes that whole day. Each event
carries `cycle`, the viewing, playthrough or reading it belongs to (2 for a
first rewatch).

Imports often bring viewings without a date. Those can't fall in a window,
so they only show in their entry's own history,
`GET /v1/library/{id}/history`, last and with a null `date`.

## Errors

Errors share one shape. `code` is stable and meant for your code; `message`
is a hint for humans and may change.

```json
{
  "statusCode": 403,
  "code": "auth.api_key_forbidden",
  "message": "auth.api_key_forbidden"
}
```

A `400` on invalid query parameters also lists the offending fields in
`details`.

## Rate limits

Each account has a budget of requests per minute, shared by all its keys:
60 by default, more with Premium where it is offered. Every response says
where you stand:

| Header                  | Meaning                               |
| ----------------------- | ------------------------------------- |
| `X-RateLimit-Limit`     | Requests allowed per minute.          |
| `X-RateLimit-Remaining` | Requests left in the current minute.  |
| `X-RateLimit-Reset`     | Seconds until the minute starts over. |

Past the limit, the API answers `429` with the code `api.rate_limited` and a
`Retry-After` header. `GET /v1/export` is also limited to once an hour per
account, answered the same way.

## CORS

The API accepts requests from any origin, without cookies: a key is the only
way in, so it can be called from a browser page as well as from a server.
