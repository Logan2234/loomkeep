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
`amd64` only, and pushes them to GHCR tagged `latest` and with the short
commit hash. `.github/workflows/deploy.yml` then redeploys the VPS after
every successful CI run (`git reset --hard origin/main`, then
`docker compose pull && docker compose up -d` with `IMAGE_TAG` pinned to
that commit). Which override files run comes from `COMPOSE_FILE` in the
VPS's own `.env`, not the workflow: turning a service on or off in
production is editing that line.

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
change. The override here only routes Caddy to its published port.

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
