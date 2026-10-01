---
title: Security
description: Reporting a vulnerability, and how Loomkeep protects accounts and data.
---

## Reporting a vulnerability

**Don't open a public issue.** Report it privately through GitHub: on the
repository's [Security tab](https://github.com/Logan2234/loomkeep/security),
choose **Report a vulnerability**. Only the maintainer sees it.

Reports against loomkeep.app are handled as real incidents: it holds real
accounts. Reports against the self-hosted setup matter just as much, since
every self-hosted instance depends on it.

Only the latest `main` is supported: there are no maintained older releases.

## How accounts are protected

- **Sessions** live in encrypted, `HttpOnly`, `SameSite=Strict` cookies,
  never in browser storage. Refresh tokens rotate and are stored hashed.
- **Passwords** found in known breaches are refused, checked through
  [Have I Been Pwned](https://haveibeenpwned.com/Passwords) without the
  password leaving the instance.
- **Two-factor authentication**: authenticator app, email codes, security
  keys and passkeys, with recovery codes. Authenticator secrets are
  encrypted at rest. Administrators must use it.
- **API keys** are stored hashed, read-only, limited to the resources they
  were granted, and revoked automatically when GitHub finds one in public.
- **Every sensitive action** is logged, and visible to its account.
- **Backups** are encrypted before they touch the disk, for a key the server
  never holds.

## How the code is checked

Every change goes through automated scans: CodeQL for the code,
Dependabot and Trivy for dependencies and images, gitleaks for committed
secrets. The repository's [OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/Logan2234/loomkeep)
rates its practices publicly.

## For self-hosters

Two secrets can't be changed casually on a running instance:

- changing `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` signs everyone out;
- changing `MFA_ENCRYPTION_KEY` locks out every account whose second factor
  is an authenticator app, unless it kept its recovery codes. If you must
  (the key leaked), have every such account turn two-factor authentication
  off first, change the key, then turn it back on.

Every other key in `.env` can be changed freely. Keep your instance on the
latest `main`: see [Upgrades](/self-hosting/upgrades-and-backups/).
