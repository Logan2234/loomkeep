---
title: Instance settings
description: What's open to every account on your instance, set from Admin › Instance settings.
---

**Admin › Instance settings** decides what every account of the instance can
use. Changes apply the next time each visitor loads the app; no restart, no
redeploy.

| Setting             | Default | What it does                                                                                        |
| ------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| Social              | off     | Follows, friends, activity feed, shared lists and other people's reviews.                           |
| Messages            | off     | Private messages between friends (needs Social). Stored unencrypted in your database.               |
| Gamification        | off     | XP, levels, achievements and leaderboard.                                                           |
| Open registration   | on      | When off, only an [invitation](/self-hosting/administration/#invitations) lets someone sign up.     |
| Public API          | on      | Personal API keys and `/api/v1`. When off, the API answers `api.disabled`; existing keys are kept.  |
| Free limit          | 60      | Public API requests per minute and per account.                                                     |
| Premium limit       | 300     | The same for premium accounts, once premium is offered.                                             |
| Update check        | on      | Looks up the latest version once a day and flags a newer one in Admin › Services.                   |
| Count this instance | on      | Sends a random id and the version with the update check: see [Telemetry](/self-hosting/telemetry/). |
| How you heard of us | off     | An optional "How did you hear of Loomkeep?" at the end of onboarding, answers in Admin › Stats.     |
| Domains             | on      | One switch per domain (films and series, games, books, music): see [below](#domains).               |

A family instance often closes registration once everyone has an account,
and leaves social on so lists can be shared.

## Domains

Each domain (films and series, games, books, music) can be turned off for
the whole instance. A domain that is off disappears from the app for every
account: navigation, search, home page, statistics, alerts. Library entries
are kept, still appear in exports, and come back when the domain is turned
on again. At least one domain stays on.

A domain whose [catalogue key](/self-hosting/catalogues/) is missing is off
whatever its switch says, and the admin page names the missing key: films
and series need `TMDB_API_TOKEN`, games `TWITCH_CLIENT_ID` and
`TWITCH_CLIENT_SECRET`. Books and music need no key.

## Setting them from the environment

Each setting can also come from an environment variable in `.env`. A
variable that is set **wins**: the admin page then shows the setting as
locked ("Set by …"). Leave them commented out to manage everything from the
page.

| Setting             | Variable                 |
| ------------------- | ------------------------ |
| Social              | `SOCIAL_ENABLED`         |
| Messages            | `CHAT_ENABLED`           |
| Gamification        | `GAMIFICATION_ENABLED`   |
| Open registration   | `REGISTRATION_ENABLED`   |
| Public API          | `PUBLIC_API_ENABLED`     |
| Free limit          | `API_RATE_LIMIT_FREE`    |
| Premium limit       | `API_RATE_LIMIT_PREMIUM` |
| Update check        | `UPDATE_CHECK_ENABLED`   |
| Count this instance | `TELEMETRY_ENABLED`      |
| How you heard of us | `ASK_ACQUISITION_SOURCE` |
| Films and series    | `MEDIA_DOMAIN_ENABLED`   |
| Games               | `GAMES_DOMAIN_ENABLED`   |
| Books               | `BOOKS_DOMAIN_ENABLED`   |
| Music               | `MUSIC_DOMAIN_ENABLED`   |

The first time the instance starts with this page, its values are taken from
these variables. After that, remove a variable from `.env` to unlock its
setting.
