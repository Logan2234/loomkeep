FROM node:26-alpine

# postgresql18-client matches the postgres:18-alpine server in docker-compose.yml
# — pg_dump/psql (admin backup & restore) shell out to it via BackupService.
RUN apk add --no-cache postgresql18-client \
  && npm install -g pnpm@11.20.0
WORKDIR /app

# Manifests first for layer caching (all workspace manifests are required
# for a frozen-lockfile install, even for packages we don't install).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @loomkeep/api...

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @loomkeep/shared build \
  && DISABLE_ERD=true pnpm --filter @loomkeep/api exec prisma generate \
  && pnpm --filter @loomkeep/api build

# Declared this late (after every expensive COPY/RUN step) on purpose: the
# value changes on every single deploy, and an ARG/ENV pair placed earlier
# would invalidate every layer below it — Docker's cache would never hit for
# the slow pnpm install/build steps above. Exposed via GET
# /api/public-stats/summary (see src/admin/public-stats.controller.ts) so
# the Homepage "Version" widget can show what's actually running.
ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA

WORKDIR /app/apps/api
EXPOSE 3000

# Migrations run at boot so a self-host upgrade is just "pull + up".
# The build nests output under dist/src (prisma.config.ts at the api root
# widens tsc's rootDir), so the entrypoint is dist/src/main.js.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/src/main.js"]
