---
title: Errors
description: The shape of an error, and every code the public API can answer with.
---

## Shape

Every error has the same body. `code` is stable and meant for your code;
`message` is a hint for humans and may change.

```json
{
  "statusCode": 403,
  "code": "auth.api_key_forbidden",
  "message": "auth.api_key_forbidden",
  "requestId": "req-1x"
}
```

Quote `requestId` when you ask for help: it finds the request in the logs. A
`validation.failed` error also names the faulty parameters in `details`:

```json
{
  "statusCode": 400,
  "code": "validation.failed",
  "message": "lang: isIn",
  "requestId": "req-1x",
  "details": [{ "field": "lang", "constraint": "isIn" }]
}
```

Branch on `code`, not on the status alone: two different `403` mean
different things.

## Codes

### Authentication

| Status | Code                        | Meaning                                            | What to do                                                    |
| ------ | --------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| `401`  | `auth.missing_access_token` | No `Authorization: Bearer` header at all.          | Send the key as `Authorization: Bearer lk_…`.                 |
| `401`  | `auth.invalid_api_key`      | The key is malformed, unknown, expired or revoked. | Check the key; create a new one if it expired or was revoked. |

### Access

| Status | Code                     | Meaning                                        | What to do                                          |
| ------ | ------------------------ | ---------------------------------------------- | --------------------------------------------------- |
| `403`  | `auth.api_key_forbidden` | The key wasn't granted this resource.          | Create a key with the scope the endpoint needs.     |
| `403`  | `api.disabled`           | The instance has turned its public API off.    | Ask the instance's administrator.                   |
| `403`  | `user.domain_disabled`   | `?domain=` names a domain the account has off. | Turn the domain on in Settings, or drop the filter. |

### Requests

| Status | Code                | Meaning                       | What to do                             |
| ------ | ------------------- | ----------------------------- | -------------------------------------- |
| `400`  | `validation.failed` | A query parameter is invalid. | Fix the parameters named in `details`. |

### Not found

| Status | Code                            | Meaning                                                     |
| ------ | ------------------------------- | ----------------------------------------------------------- |
| `404`  | `library.entry_not_found`       | No such entry in your library, or its domain is turned off. |
| `404`  | `lists.not_found`               | No such list, or one you can't edit.                        |
| `404`  | `gamification.feature_disabled` | Gamification is off on this instance (achievements).        |

### Limits

| Status | Code               | Meaning                                                         | What to do                                                        |
| ------ | ------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `429`  | `api.rate_limited` | The minute's budget is spent, or the hourly export already ran. | Wait `Retry-After` seconds: see [Rate limits](/api/rate-limits/). |

### Server

| Status | Code             | Meaning                      | What to do                                                                                       |
| ------ | ---------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `500`  | `internal.error` | Something broke on our side. | Retry later; check [status.loomkeep.app](https://status.loomkeep.app) and quote the `requestId`. |

A `502`, `503` or `504` without a JSON body comes from in front of the API:
the instance is down or restarting. Retry with a growing delay.
