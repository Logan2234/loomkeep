---
title: Security
description: Keeping API keys safe, and what to do when one leaks.
---

An API key reads your account without a password or a second factor.
Treat it like a password.

## What a key can and can't do

A key only **reads**, and only the resources it was granted. It can't change
your password, your two-factor authentication, your devices or your keys,
nor delete your account: those stay behind your session in the app.

## Keeping keys safe

- **One key per tool.** Revoking one then breaks nothing else, and
  **Settings › Integrations** shows when each was last used, and from where.
- **Grant the least.** A calendar widget needs `calendar:read`, nothing more.
- **Give it a lifetime.** Prefer an expiry over "never": you get an email a
  week before a key expires, and a key unused for a year is deleted anyway.
- **Keep it out of code.** Read it from an environment variable or a secrets
  manager (`!secret` in Home Assistant, a credential in n8n), never from a
  file you commit.
- **Keep it off public pages.** The API answers browsers, but a key written
  into a web page's JavaScript is readable by anyone who opens it. Call the
  API from a server, or from a page only you use.

## If a key leaks

Revoke it in **Settings › Integrations**: it stops working at once. Then
create a new one for your tools.

On loomkeep.app, GitHub's secret scanning watches public repositories,
gists, issues and npm packages for Loomkeep keys. One found there is revoked
automatically, and you get an email saying where it was found. Remove it
from there, history included.

Changing your password doesn't revoke your keys, since a key isn't a
session: you are reminded of the active ones instead. If someone else
changed it, revoke them all with **Revoke all**.

## Reporting a vulnerability

Found a security issue in Loomkeep itself? Don't open a public issue: write
to the address in the repository's
[security policy](https://github.com/Logan2234/loomkeep/security/policy).
