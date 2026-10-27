# Docker stack: how loomkeep.app is run

Setting up an instance is documented on
[docs.loomkeep.app/self-hosting](https://docs.loomkeep.app/self-hosting/):
installation, every variable, HTTPS, Cloudflare, backups and each optional
service. This file only keeps what concerns the hosted instance and the
decisions that span several files here. A setting's own reason lives as a
comment next to it, in its compose or Caddy file.

## Images & deploy

The `docker-push` job in `.github/workflows/ci.yml` builds
`apps/api/Dockerfile` and `apps/web/Dockerfile` on every push to `main`, for
`amd64` and `arm64`, each on a runner of that architecture. `docker-tag`
then tags both platforms together (arm64 is optional: if it fails, amd64 is
tagged alone):

| Tag                             | Set on                                | For                                    |
| ------------------------------- | ------------------------------------- | -------------------------------------- |
| 12-character commit SHA         | every commit on `main`                | the deploy, pinning a build            |
| `edge`                          | every commit on `main`                | following `main`; Trivy's weekly scan  |
| `1.12.0`, `1.12`, `1`, `latest` | the first build of a new root version | self-hosters (`latest` is the default) |

`ghcr-cleanup.yml` keeps those named tags and the 30 newest commit tags,
and deletes the rest every Monday, with the platform images and
attestations that belong to them (the "untagged" versions in the package
view). The `unknown/unknown` platform there is each image's provenance
attestation, not an image.

`.github/workflows/ci.yml` ends every `main` run by redeploying the VPS,
once every check passed and the images are tagged (its `deploy` job; a run
whose commit is no longer `main`'s head leaves it to the newer one): it resets the checkout to that commit and runs
`.github/deploy/vps-deploy.sh`. That script dumps the database (encrypted,
the last 5 kept in `~/loomkeep-predeploy/`), pulls the commit's images, and
waits for the healthchecks. When the new containers don't come up and no
migration ran, it starts the previous images again; after a migration it
leaves them stopped (old code on a newer schema) and the dump is the way
back. Either way the job fails and ntfy alerts. Which override files run
comes from `COMPOSE_FILE` in the VPS's own `.env`, not the workflow:
turning a service on or off in production is editing that line.

## Releases

Merging a PR that bumps the version (the `version-bump` skill) is the
release; nothing is tagged by hand:

1. CI passes on the bump commit; `docker-tag` adds the version tags and
   moves `latest`.
2. The `release` job creates the GitHub release `v1.12.0` (a tag on that
   commit), its notes being the version's `CHANGELOG.md` section.
3. `publish-release-apk` attaches `loomkeep-android.apk` and its Sigstore
   provenance, then marks the release latest, so
   `releases/latest/download/loomkeep-android.apk` keeps working.

All three happen in the same `ci.yml` run and check what already exists
rather than whether the commit changed the version: when the bump's run
never gets that far, the next commit on `main` makes up for it.

A release is created once and never rewritten: merging more commits
without a bump changes no release. Dev APKs are `android-dev-<n>`
pre-releases on every `main` change to `apps/mobile`, the three newest
kept. Releases and their tags otherwise stay: they are the history and the
only way to install an older version.

Each run then reports on ntfy (`.github/deploy/notify.sh`): an alert when
CI failed or was cancelled on main's latest commit (nothing deployed) or
when the deploy itself failed, and a low-priority note once a commit is
live. Set the repo secret `NTFY_TOPIC_URL` to a topic's full URL with an
unguessable name (`https://ntfy.sh/loomkeep-deploy-<random>`, anyone
knowing it can read and post) and subscribe to it in the ntfy app.

## Shared Postgres for add-ons

GlitchTip, Unleash and Umami each get a database on the app's `db` service
instead of their own container: one Postgres process on a single VPS. Each
database is created only on a brand-new volume (their `init-*-db.sql`); on
an existing volume, create it once by hand with the command in that file.

## Access control per public subdomain

Depends on whether Cloudflare Access is in front (loomkeep.app,
`docker-compose.tunnel.yml`) or not (self-hosters, by default):

- **With Cloudflare Access**: every admin hostname (`grafana.`, `portainer.`,
  `errors.`, `flags.`, `home.`) goes through the tunnel below, gated by
  GitHub SSO and MFA before reaching Caddy. Grafana, GlitchTip and Portainer
  use Access as their OIDC provider too. Unleash needs bypasses for
  `/api/client/*` and `/api/frontend/*`, Grafana for `/api/health` from
  UptimeRobot's addresses.
- **Without it**: Authelia, either as an OIDC provider (Grafana, GlitchTip,
  Portainer) or through Caddy's `forward_auth` (Homepage, which has no login
  of its own). Unleash and Umami keep only their own login: their frontend
  API and tracker must stay reachable by every visitor. Quackback has its own
  email login.

Authelia isn't deployed on loomkeep.app any more; it stays the documented
path for self-hosters without Cloudflare.

## Cloudflare Tunnel + Access

`cloudflared` holds an outbound-only connection to Cloudflare for every
admin hostname, so there is no origin address left to bypass Access with.
Each admin service's `*.caddy` file declares two addresses: its public
hostname (automatic HTTPS, for self-hosters on plain DNS) and
`{$X_SITE_ADDRESS}:8080`, plain HTTP, which only `cloudflared` reaches
(`expose`, never `ports`). The same Caddyfile thus works with or without the
tunnel. The dashboard setup is in `docker-compose.tunnel.yml`'s header.

## Backups

Two independent layers, encrypted for the same age public key:

- **In-app** (`apps/api/src/admin/backup.service.ts`): the `loomkeep`
  database only, nightly, 7 kept, restored from Admin › Backup.
- **Offsite** (`backup-offsite.sh`, from the VPS's cron): every database on
  the shared Postgres (`loomkeep`, `unleash`, `glitchtip`, `umami`) and
  Quackback's whole stack, shipped to Cloudflare R2 with `rclone`, so a lost
  VPS doesn't take the backups with it. Coverage and one-time setup are in
  the script's header.

Key generation and restoring:
[Upgrades & backups](https://docs.loomkeep.app/self-hosting/upgrades-and-backups/).

## User feedback board (`docker-compose.quackback.yml`)

[Quackback](https://quackback.io) runs as its own unmodified deployment,
bootstrapped with `quackback-bootstrap.sh`: translating its stack (its own
Postgres, Dragonfly, MinIO) into this repo would drift with every upstream
change. The override here only routes Caddy to its published port. The
in-app launcher appears only when the web has `PUBLIC_QUACKBACK_URL`
(`https://feedback.loomkeep.app` here): a self-hosted instance loads nothing
from the board unless it sets its own.

## Homepage dashboard

`homepage/` is loomkeep.app's own admin start page; self-hosters get the
setup in the docs, these are the choices behind it:

- **No Docker socket.** Tiles read each tool's API. Per-container stats were
  left to Grafana and cAdvisor.
- **Loomkeep's tile** reads `GET /api/public-stats/summary`, four cheap
  counts behind `HOMEPAGE_STATS_API_KEY`, not the admin stats (too heavy for
  a 10 s poll) nor Terminus's `/health`, whose `error: {}` field crashes
  Homepage's `customapi` widget.
- **GitHub tiles** share `HOMEPAGE_GITHUB_TOKEN`, a fine-grained token with
  Dependabot alerts and Code scanning alerts read-only: both are gated even
  on a public repo. Alert totals are capped at 100, GitHub's page size.
- **Layout**: widgets stacked with `widgets:` always render vertically, so
  multi-call tiles are two rows. `style: row` is required for `columns` to
  apply. Group icons accept `mdi-`/`si-` names but not emoji. Value
  highlighting isn't supported on `customapi` widgets.
- A full reskin was tried and reverted: the tile markup is fixed. Only one
  `custom.css` rule is left.

## Operator checklist

Yearly: check that the OVH account behind loomkeep.app still carries
Logan's real identity and address, which the LCEN art. 6-III exemption from
publishing personal legal notices relies on.
