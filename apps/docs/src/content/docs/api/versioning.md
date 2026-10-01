---
title: Versioning
description: What v1 promises to keep stable, and how a breaking change would reach you.
---

The public API lives under `/api/v1`. The app's own routes, outside `/v1`,
can change with any release and aren't meant for scripts.

## What stays stable in v1

Within v1, changes only **add**:

- new endpoints;
- new fields in responses;
- new optional query parameters;
- new values in an enum: a new status, a new history event type, a new
  domain. Handle a value you don't know rather than failing on it.

A field is never removed or renamed, never changes type, and an existing
parameter never changes meaning.

## Breaking changes

A change that can't be made by adding goes into a new version, `/api/v2`,
which then lives alongside v1 for a while. Before v1 goes away, its retirement
is announced in the [changelog](https://feedback.loomkeep.app/changelog) at
least six months ahead, and its responses carry `Deprecation` and `Sunset`
headers saying when.

## Following changes

New endpoints and fields are announced in the
[changelog](https://feedback.loomkeep.app/changelog). Each instance serves
the exact contract it runs at `/api/v1/openapi.json`: a self-hosted instance
on an older release can lack the newest additions.
