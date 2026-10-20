---
title: Optional services
description: Monitoring, error tracking, analytics and more, each one compose file away.
sidebar:
  order: 0
---

Loomkeep runs without any of these. Each is the setup loomkeep.app itself
uses, packaged as a compose override: add its file to `COMPOSE_FILE`, fill in
its variables, and restart. Remove the file to turn it off.

| Service                                                                          | What it adds                                                 | File                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| [Monitoring](/self-hosting/optional-services/monitoring/)                        | Grafana dashboards, searchable logs, metrics; job monitoring | `docker-compose.observability.yml`                           |
| [Error tracking](/self-hosting/optional-services/error-tracking/)                | GlitchTip, errors grouped and alerted                        | `docker-compose.glitchtip.yml`                               |
| [Analytics](/self-hosting/optional-services/analytics/)                          | Umami, cookie-less stats for the public landing page         | `docker-compose.umami.yml`                                   |
| [Feature flags](/self-hosting/optional-services/feature-flags/)                  | Unleash: maintenance per domain, a news banner               | `docker-compose.unleash.yml`                                 |
| [Docker UI](/self-hosting/optional-services/portainer/)                          | Portainer, to manage containers from a browser               | `docker-compose.portainer.yml`                               |
| [Single sign-on & dashboard](/self-hosting/optional-services/sso-and-dashboard/) | Authelia for one login, Homepage as a start page             | `docker-compose.authelia.yml`, `docker-compose.homepage.yml` |

Services with a web interface get their own subdomain behind Caddy
(`grafana.<DOMAIN>`, `errors.<DOMAIN>`…), so they need the
[HTTPS override](/self-hosting/https/) and DNS records for those names.
GlitchTip, Unleash and Umami keep their data in Loomkeep's PostgreSQL, in
databases of their own: no extra database to run.
