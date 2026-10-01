---
title: Rate limits
description: How many requests an account can make, how to tell where you stand, and how to stay well within it.
---

## The budget

Each account has a budget of requests per minute, **shared by all its keys**:
60 on loomkeep.app, more with Premium where it is offered. A self-hosted
instance sets its own limits in **Admin › Settings**. `GET /v1/me` says what
yours is.

`GET /v1/export` also has its own pace: **once an hour** per account.

## Where you stand

Every response says how much is left:

| Header                  | Meaning                               |
| ----------------------- | ------------------------------------- |
| `X-RateLimit-Limit`     | Requests allowed per minute.          |
| `X-RateLimit-Remaining` | Requests left in the current minute.  |
| `X-RateLimit-Reset`     | Seconds until the minute starts over. |

Past the limit, the API answers `429` with the code `api.rate_limited` and a
`Retry-After` header, in seconds. The hourly export answers the same way.

## Staying well within it

- **Wait for `Retry-After`** after a `429` rather than retrying at once; a
  loop that keeps retrying only keeps the account blocked.
- **Poll gently.** A dashboard widget needs nothing faster than every 5 to
  15 minutes: the calendar and stats don't change by the second.
- **Ask for less.** Filter on the server (`?phase=`, `?domain=`, `from` and
  `to` on the history) instead of paging through everything and filtering
  afterwards, and use `limit=100` when you do need every page.
- **Sync incrementally.** To keep a copy of your history, ask only for what
  happened since your last run with `GET /v1/history?from=…`.
- **Back up with the export.** One `GET /v1/export` a day gets everything;
  paging through every endpoint costs far more requests.
- **Cache what barely moves**: your profile, your lists, last year's stats.
