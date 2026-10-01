---
title: Authentication
description: Personal API keys, their scopes and their lifetime.
---

Every request carries a personal API key in the `Authorization` header:

```
Authorization: Bearer lk_…
```

Keys start with `lk_`, which makes a leaked one easy to spot. Create, review
and revoke them in **Settings › Integrations**.

A key is `lk_` followed by 49 letters and digits, the last six being a
checksum of the rest (`lk_[0-9A-Za-z]{49}`). A string that fails the checksum
is refused straight away, with a `401`.

## Scopes

A key only reaches the resources it was granted, all read-only for now:

| Scope                | Endpoints                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------- |
| _(any key)_          | `GET /v1/me`                                                                                 |
| `library:read`       | `GET /v1/library`, `GET /v1/library/{id}`, `GET /v1/library/{id}/history`, `GET /v1/history` |
| `lists:read`         | `GET /v1/lists`, `GET /v1/lists/{id}`                                                        |
| `calendar:read`      | `GET /v1/calendar`                                                                           |
| `stats:read`         | `GET /v1/stats/summary`                                                                      |
| `reviews:read`       | `GET /v1/reviews`                                                                            |
| `profile:read`       | `GET /v1/profile`, `GET /v1/profile/achievements`                                            |
| `notifications:read` | `GET /v1/notifications`                                                                      |
| `export:read`        | `GET /v1/export`                                                                             |

A key never reaches anything outside `/v1`: it can't change your password,
your two-factor authentication, your devices or your keys, nor delete your
account.

## Lifetime

A key expires after the duration chosen when creating it (30 days, 90 days,
a year, a custom date) or never. You get an email a week before it expires.
A key nobody has used for a year is deleted.

Revoking a key takes effect immediately. Changing your password does **not**
revoke your keys: you are reminded of the active ones instead, so you can
revoke them if the change wasn't yours.

## If a key leaks

On loomkeep.app, GitHub's secret scanning looks for Loomkeep keys in public
repositories, gists, issues and npm packages, and reports each one it finds.
A reported key is revoked at once, and you get an email saying where it was
found, plus a notification. Remove it from there, history included, then
create a new key.

A self-hosted instance isn't covered: GitHub reports keys to loomkeep.app
only. Revoke a leaked key yourself in **Settings › Integrations**.

## Errors

A missing or bad key is a `401`, a key without the scope an endpoint needs is
a `403` (`auth.api_key_forbidden`). Every code is in [Errors](/api/errors/).
