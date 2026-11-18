---
title: Telemetry
description: The one thing your instance tells loomkeep.app, why, and how to turn it off.
---

Loomkeep has no way to know how many instances run outside loomkeep.app.
To find out, the daily [update check](/self-hosting/scheduled-jobs/) asks
loomkeep.app for the latest version, and sends two values along with the
question.

## What is sent

Once a day, at 5:30 a.m. server time, one `POST` to
`https://loomkeep.app/api/instances/ping` with:

| Field        | Example                                | What it is                                                                                                         |
| ------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `instanceId` | `0b6f3c3e-8d4a-4f7e-9a51-2c1d5e7f9a10` | A random id your instance generates the first time it sends one. Nothing about the server or its users goes in it. |
| `version`    | `1.15.0`                               | The Loomkeep version the instance runs.                                                                            |

Nothing else: no address, domain, account, library or usage figure. The
answer is the latest version, shown in **Admin › Services**.

## What is kept

loomkeep.app keeps, for each id, the version and the first and last day it
was seen. It counts the ids seen in the last 30 days, by version, and
deletes an id once it hasn't been seen for 90 days.

Your IP address isn't stored: neither in the database nor in the API's or
the reverse proxy's logs. Like any request to loomkeep.app, it goes through
its hosting network, which sees the address in transit.

The id is random but stays the same from one day to the next, so it is
pseudonymous rather than anonymous: it tells instances apart without saying
whose they are.

## Turning it off

- **Admin › Instance settings › Count this instance**, or
  `TELEMETRY_ENABLED=false` in `.env`. The update check then reads the
  version from a public file on GitHub instead, sending nothing.
- `UPDATE_CHECK_ENABLED=false` turns off the update check itself: the
  instance then makes no request of its own to loomkeep.app or GitHub.

If loomkeep.app doesn't answer, the update check falls back to GitHub too.
