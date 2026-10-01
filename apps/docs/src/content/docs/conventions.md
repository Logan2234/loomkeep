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
`Retry-After` header. `GET /v1/export` is also limited to once an hour.

## CORS

The API accepts requests from any origin, without cookies: a key is the only
way in, so it can be called from a browser page as well as from a server.
