---
title: Instance settings
description: What's open to every account on your instance, set from Admin › Instance settings.
---

**Admin › Instance settings** decides what every account of the instance can
use. Changes apply the next time each visitor loads the app; no restart, no
redeploy.

| Setting           | Default | What it does                                                                                       |
| ----------------- | ------- | -------------------------------------------------------------------------------------------------- |
| Social            | off     | Follows, friends, activity feed, shared lists and other people's reviews.                          |
| Gamification      | off     | XP, levels, achievements and leaderboard.                                                          |
| Open registration | on      | When off, only an [invitation](/self-hosting/administration/#invitations) lets someone sign up.    |
| Public API        | on      | Personal API keys and `/api/v1`. When off, the API answers `api.disabled`; existing keys are kept. |
| Free limit        | 60      | Public API requests per minute and per account.                                                    |
| Premium limit     | 300     | The same for premium accounts, once premium is offered.                                            |

A family instance often closes registration once everyone has an account,
and leaves social on so lists can be shared.

## Setting them from the environment

Each setting can also come from an environment variable in `.env`. A
variable that is set **wins**: the admin page then shows the setting as
locked ("Set by …"). Leave them commented out to manage everything from the
page.

| Setting           | Variable                 |
| ----------------- | ------------------------ |
| Social            | `SOCIAL_ENABLED`         |
| Gamification      | `GAMIFICATION_ENABLED`   |
| Open registration | `REGISTRATION_ENABLED`   |
| Public API        | `PUBLIC_API_ENABLED`     |
| Free limit        | `API_RATE_LIMIT_FREE`    |
| Premium limit     | `API_RATE_LIMIT_PREMIUM` |

The first time the instance starts with this page, its values are taken from
these variables. After that, remove a variable from `.env` to unlock its
setting.
