FROM node:26-alpine@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS build

RUN corepack enable && corepack prepare pnpm@11.23.0 --activate
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @loomkeep/web...

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @loomkeep/shared build && pnpm --filter @loomkeep/web build

# adapter-node's SSR build doesn't safely bundle every server-side dependency
# into build/ — @loomkeep/shared (a linked workspace package, see the
# ssr.external comment in vite.config.ts) and @sentry/sveltekit (GlitchTip
# error reporting from src/lib/api/core.ts) both stay real npm imports build/'s
# server chunks resolve at runtime, so build/ alone isn't self-contained.
# `pnpm install --prod` alone isn't enough either: this is a pnpm workspace,
# and the workspace's shared virtual store keeps every package ever resolved
# for the monorepo's single lockfile. `pnpm deploy` instead materializes only
# @loomkeep/web's actual production dependency graph as real files — see the
# API Dockerfile's identical use of this for the same reasoning. `--legacy`
# links @loomkeep/shared as a relative symlink
# (deploy/node_modules/@loomkeep/shared -> ../../../packages/shared) rather
# than copying it in, so `deploy`'s directory depth relative to
# `packages/shared` has to be preserved below — the deploy output can't be
# flattened into /app directly.
#
# `deploy` packs apps/web the way `npm publish` would, which respects
# apps/web's own .gitignore — and /build is gitignored (it's generated), so
# it's never in `deploy`'s output. node_modules is still the only thing we
# need from it; build/ itself is copied straight from the build stage below.
RUN pnpm --filter @loomkeep/web deploy --prod --legacy /app/deploy

FROM node:26-alpine@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3
WORKDIR /app
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/deploy ./deploy
COPY --from=build /app/apps/web/build ./deploy/build
WORKDIR /app/deploy
ENV PORT=3000
EXPOSE 3000
CMD ["node", "build"]
