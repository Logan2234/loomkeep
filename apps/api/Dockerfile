FROM node:26-alpine@sha256:aadf416b2cdce311a8811ba3f0608a61b77dbf997500e2eafe781b51f6a0b019 AS build

RUN npm install -g pnpm@11.20.0
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

# `pnpm install --prod` alone isn't enough here: this is a pnpm workspace, and
# the workspace's shared virtual store (node_modules/.pnpm) keeps every
# package ever resolved for the monorepo's single lockfile — including huge
# unrelated trees like apps/web's `mermaid` or the ERD generator's headless
# Chromium/canvas deps — even after devDependencies are pruned from apps/api's
# own symlinks. `pnpm deploy` instead materializes only @loomkeep/api's actual
# production dependency graph as real files, which is what keeps the runtime
# image from smuggling in gigabytes of unrelated workspace packages.
RUN pnpm --filter @loomkeep/api deploy --prod --legacy /app/deploy

# `pnpm deploy` rebuilds node_modules from the store from scratch, so it
# doesn't carry over the Prisma Client generated above — regenerate it here.
# `--generator client` skips the schema's `erd` generator, whose package is a
# devDependency the prod-only deploy output doesn't have.
RUN cd /app/deploy && node_modules/.bin/prisma generate --generator client

FROM node:26-alpine@sha256:aadf416b2cdce311a8811ba3f0608a61b77dbf997500e2eafe781b51f6a0b019

# postgresql18-client matches the postgres:18-alpine server in docker-compose.yml
# — pg_dump/psql (admin backup & restore) shell out to it via BackupService.
RUN apk add --no-cache postgresql18-client
WORKDIR /app

# `--legacy` deploy links @loomkeep/shared as a relative symlink
# (deploy/node_modules/@loomkeep/shared -> ../../../packages/shared) rather
# than copying it in, so `deploy`'s directory depth relative to
# `packages/shared` has to be preserved here — the deploy output can't be
# flattened into /app directly.
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/deploy ./deploy
WORKDIR /app/deploy

# Declared this late (after every expensive COPY/RUN step) on purpose: the
# value changes on every single deploy, and an ARG/ENV pair placed earlier
# would invalidate every layer below it — Docker's cache would never hit for
# the slow pnpm install/build steps above. Exposed via GET
# /api/public-stats/summary (see src/admin/public-stats.controller.ts) so
# the Homepage "Version" widget can show what's actually running.
ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA

EXPOSE 3000

# Migrations run at boot so a self-host upgrade is just "pull + up".
# The build nests output under dist/src (prisma.config.ts at the api root
# widens tsc's rootDir), so the entrypoint is dist/src/main.js. Calling the
# local binary directly (rather than `pnpm exec`) means the runtime image
# doesn't need pnpm installed at all.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/src/main.js"]
