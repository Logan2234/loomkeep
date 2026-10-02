---
title: Requirements
description: The machine, architecture and network access a Loomkeep instance needs.
---

## The machine

| Resource   | Base setup                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------- |
| **Memory** | About 350 MB in use on a fresh instance (API 210 MB, web 85 MB, PostgreSQL 40 MB). Plan 1 GB.  |
| **Disk**   | About 2 GB for the images, plus the database, which grows with what people track, and backups. |
| **CPU**    | One core is enough; work peaks during imports and the catalogue refreshes.                     |
| **Docker** | Docker Engine with Compose v2 (`docker compose`, not `docker-compose`).                        |

Each [optional service](/self-hosting/optional-services/) adds its own
containers on top; monitoring, with Grafana, Loki and Prometheus, is by far
the heaviest.

## Architecture

The images are built for **x86-64** (`amd64`) and **64-bit ARM** (`arm64`);
Docker pulls the right one on its own. That covers VPSs and ARM cloud
servers, mini PCs, NAS models, Apple Silicon Macs, and a Raspberry Pi 4 or 5
running a 64-bit system.

32-bit ARM (`armv7`, older Raspberry Pis or a 32-bit system) isn't
supported.

## Systems

Anything that runs Docker Compose works the same way: a Linux
server, a NAS with a Docker app, or Docker Desktop on Windows and macOS for
a try. The [installation](/self-hosting/installation/) needs a shell on it,
to clone the repository and run two commands.

On a NAS, keep the repository on a volume that is backed up, since `.env`
and your keys live there, and point the addresses at the NAS: see
[Installation](/self-hosting/installation/).

## Network

- **Outgoing**: the server reaches the catalogues (TMDB, AniList, IGDB, Open
  Library, MusicBrainz) live on every search, and the GitHub Container
  Registry for updates.
- **Incoming**: ports 8080 and 3000 on a home network, or 80 and 443 with
  [a domain and HTTPS](/self-hosting/https/).
- **A domain with HTTPS** is required to install the app on a phone and for
  push notifications.
