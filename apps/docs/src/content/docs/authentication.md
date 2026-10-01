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

## Scopes

A key only reaches the resources it was granted, all read-only for now:

| Scope                | Endpoints                                         |
| -------------------- | ------------------------------------------------- |
| _(any key)_          | `GET /v1/me`                                      |
| `library:read`       | `GET /v1/library`, `GET /v1/library/{id}`         |
| `lists:read`         | `GET /v1/lists`, `GET /v1/lists/{id}`             |
| `calendar:read`      | `GET /v1/calendar`                                |
| `stats:read`         | `GET /v1/stats/summary`                           |
| `reviews:read`       | `GET /v1/reviews`                                 |
| `profile:read`       | `GET /v1/profile`, `GET /v1/profile/achievements` |
| `notifications:read` | `GET /v1/notifications`                           |
| `export:read`        | `GET /v1/export`                                  |

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

## Errors

| Status | Code                     | Meaning                                     |
| ------ | ------------------------ | ------------------------------------------- |
| `401`  | `auth.invalid_api_key`   | The key is unknown, expired or revoked.     |
| `403`  | `auth.api_key_forbidden` | The key wasn't granted this resource.       |
| `403`  | `api.disabled`           | The instance has its public API turned off. |
