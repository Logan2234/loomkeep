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

## Reporting a vulnerability

Please **do not** open a public issue for a security vulnerability.

Instead, use GitHub's private reporting: go to the
[Security tab](https://github.com/Logan2234/loomkeep/security) →
**Report a vulnerability**. This opens a private advisory visible only to
the maintainer.

Dependency vulnerabilities are additionally tracked automatically via
Dependabot and CodeQL, both enabled on this repository.
