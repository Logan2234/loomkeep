---
title: Self-hosting
description: What running your own Loomkeep instance takes, and what you are responsible for.
---

Loomkeep is open source (AGPL-3.0): you can run your own instance, for
yourself, your family or anyone, with your data in your own database. It is
the same code as loomkeep.app.

## What you need

- **A machine running Docker** with Docker Compose v2: a home server, a NAS,
  or a small VPS.
- **A TMDB API token**, free, for films and series. The other catalogues are
  optional or need no key: see [Catalogue keys](/self-hosting/catalogues/).
- **For phones**: a domain name and HTTPS. Installing the app on a phone and
  push notifications don't work over plain HTTP. See
  [Domain & HTTPS](/self-hosting/https/).

Email (password resets, alerts) and push notifications are optional:
everything else works without them.

## How it is packaged

Two images, built for every release and pulled from the GitHub Container
Registry: `ghcr.io/logan2234/loomkeep-api` and `loomkeep-web`. A
`docker/docker-compose.yml` file runs them with PostgreSQL; optional
**compose overrides** add a reverse proxy with HTTPS, monitoring, analytics
and more, each switched on by adding one file to a list.

## Your responsibility

Opening your instance to other people makes you responsible for their data:
under the GDPR, you are its data controller. Loomkeep's own legal notices
and privacy policy only cover loomkeep.app. You need your own; the privacy
policy's section on self-hosted instances is a starting point to adapt.

## Where to start

1. [Install](/self-hosting/installation/) Loomkeep and create your account.
2. Add your [catalogue keys](/self-hosting/catalogues/), then
   [email and push](/self-hosting/email-and-push/).
3. Put it on [a domain with HTTPS](/self-hosting/https/) if others, or your
   phone, will use it.
4. Choose what's open in [instance settings](/self-hosting/instance-settings/),
   and set up [backups](/self-hosting/upgrades-and-backups/).
