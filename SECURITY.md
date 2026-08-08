# Security Policy

Loomkeep is a self-hosted, single-owner project — there's no hosted
multi-tenant instance to protect, but a vulnerability in the code still
matters for anyone self-hosting it.

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
