# Security Policy

Loomkeep ships two ways: self-hosted (your own PostgreSQL, your own data),
and as a hosted instance at [loomkeep.app](https://loomkeep.app) with real
user accounts — registration, auth, and personal data (watch history,
reviews, social graph) that a vulnerability could actually expose. Both
matter: a report against the hosted instance is treated like a real
multi-tenant incident, and a report against the self-hosted path is treated
as something every self-hoster's data depends on.

## Supported versions

No tagged releases exist yet (see `CHANGELOG.md`/`CLAUDE.md` for the
versioning convention) — only the `main` branch is supported. Always
self-host from the latest `main`.

## Rotating secrets

Rotating a secret "for hygiene" is good practice in general and **breaks
this instance** for two of them. Neither is a bug to be fixed later: both
are a deliberate consequence of encrypting at rest with a key derived from
configuration, and they are written down here because nothing at runtime
warns you.

**`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`** — the cookie encryption key
is derived from both (`sha256(access ‖ refresh)`), so changing either makes
every existing session cookie undecryptable. Everyone is signed out at
once. Nothing is lost: users sign in again. Rotate during a quiet window
and expect the support questions.

**`MFA_ENCRYPTION_KEY`** — this one is not recoverable. It encrypts TOTP
secrets at rest; rotating it makes all of them undecryptable, so every
account whose second factor is TOTP can no longer complete a login. Their
recovery codes are hashed separately and still work, so a user who kept
them can get back in and re-enrol — a user who did not is locked out
permanently.

If you must rotate it (suspected key compromise), the only safe sequence
is: ask every MFA user to disable MFA, rotate the key, restart, then have
them re-enrol. There is no migration path that re-encrypts existing secrets
under a new key — implementing one would mean holding both keys during the
transition, which is on the roadmap only if the need turns out to be real.

Everything else in `.env` is rotatable freely: provider API keys, SMTP
credentials, webhook secrets, `HOMEPAGE_STATS_API_KEY`, `METRICS_API_KEY`.
None of them decrypts stored data.

## Reporting a vulnerability

Please **do not** open a public issue for a security vulnerability.

Instead, use GitHub's private reporting: go to the
[Security tab](https://github.com/Logan2234/loomkeep/security) →
**Report a vulnerability**. This opens a private advisory visible only to
the maintainer.

Dependency vulnerabilities are additionally tracked automatically via
Dependabot and CodeQL, both enabled on this repository.
