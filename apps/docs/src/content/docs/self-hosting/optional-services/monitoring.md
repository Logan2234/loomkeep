---
title: Monitoring
description: Grafana, Loki and Prometheus for logs and metrics, and Healthchecks.io for scheduled jobs.
sidebar:
  order: 1
---

Without anything added, `docker compose logs api` shows the API's
structured logs. This override adds history and dashboards:

- **Grafana**, at `grafana.<DOMAIN>`, behind its own login;
- **Loki and Promtail**: every container's logs, searchable;
- **Prometheus** with node and PostgreSQL exporters: CPU, memory, disk and
  database metrics, plus the API's own (`/api/metrics`).

## Enabling it

1. Set `GRAFANA_ADMIN_PASSWORD` in `.env`.
2. To collect the API's metrics, set `METRICS_API_KEY` to a long random
   string, and write the same value, with no trailing newline, to
   `docker/observability/metrics_token`.
3. Add `docker/docker-compose.observability.yml` to `COMPOSE_FILE` in `.env`, then:

```sh
docker compose pull
docker compose up -d
```

Grafana is also reachable at `127.0.0.1:3001` on the server, through an SSH
tunnel (`ssh -L 3001:localhost:3001 you@server`), with or without a domain.

## Scheduled jobs

Loomkeep runs about ten scheduled jobs (new-episode checks, catalogue
refreshes, the nightly backup…). A job that silently stops running leaves
everything else looking healthy. [Healthchecks.io](https://healthchecks.io)
catches that: create one check per job with its schedule, then put each ping
URL in its `HEALTHCHECKS_*_URL` variable (the list is in `.env.example`).
Each job pings once it finishes; Healthchecks.io alerts you when a ping
doesn't arrive. No container to run. **Admin › Jobs & tasks** shows each
job's last runs.
