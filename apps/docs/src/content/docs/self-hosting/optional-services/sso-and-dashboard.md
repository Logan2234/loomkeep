---
title: Single sign-on & dashboard
description: Authelia for one login across the admin tools, and Homepage as their start page.
sidebar:
  order: 6
---

With several admin tools, each with its own password, two services help:

- [Authelia](https://www.authelia.com), at `auth.<DOMAIN>`: one login, with
  two-factor authentication, for Grafana, GlitchTip and Portainer, which
  hand sign-in over to it.
- [Homepage](https://gethomepage.dev), at `home.<DOMAIN>`: one page with a
  tile per tool and live figures. It has no login of its own, so it
  **requires Authelia** in front of it.

These are for you, the administrator: Loomkeep's own accounts don't go
through Authelia.

## Setting them up

Authelia needs a configuration and secrets of its own: copy
`docker/authelia/configuration.yml.example` and `users_database.yml.example`
without the `.example`, and fill in every `REPLACE_ME`. The repository's
README walks through generating each secret and connecting Grafana,
GlitchTip and Portainer. **Authelia refuses to start without working SMTP.**

Then add `docker/docker-compose.authelia.yml` and
`docker/docker-compose.homepage.yml` to `COMPOSE_FILE`, and restart.

Homepage's tiles read each tool's API: fill in the matching keys in `.env`
(`PORTAINER_API_KEY`, `GLITCHTIP_API_TOKEN`, …). A missing key only leaves
its tile without figures.

To add Loomkeep's own figures to an existing Homepage, see the
[Homepage recipe](/api/recipes/homepage/).
