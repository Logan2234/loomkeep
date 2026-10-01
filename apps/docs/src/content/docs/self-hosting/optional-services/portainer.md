---
title: Docker UI
description: Portainer, to manage containers, images and volumes from a browser.
sidebar:
  order: 5
---

[Portainer](https://www.portainer.io) shows the stack's containers, images,
volumes and logs in a browser, at `portainer.<DOMAIN>`, so you rarely need
SSH. Its admin account is created on the first visit: do it right after
starting it.

Add `docker/docker-compose.portainer.yml` to `COMPOSE_FILE` in `.env`, then:

```sh
docker compose pull
docker compose up -d
```
