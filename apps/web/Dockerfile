FROM node:26-alpine@sha256:aadf416b2cdce311a8811ba3f0608a61b77dbf997500e2eafe781b51f6a0b019 AS build

RUN npm install -g pnpm@11.20.0
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @loomkeep/web...

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @loomkeep/shared build && pnpm --filter @loomkeep/web build

# adapter-node's SSR build can't safely bundle @loomkeep/shared (see the
# ssr.external comment in vite.config.ts — it's a CJS dist/ build, and Vite's
# default inlining for linked workspace packages evaluates it as ESM and
# crashes), so it stays a real "@loomkeep/shared" import in build/'s server
# chunks that Node has to resolve at runtime — build/ alone isn't
# self-contained, node_modules/@loomkeep/shared has to ship alongside it.
FROM node:26-alpine@sha256:aadf416b2cdce311a8811ba3f0608a61b77dbf997500e2eafe781b51f6a0b019
WORKDIR /app
COPY --from=build /app/apps/web/build ./build
COPY --from=build /app/packages/shared/package.json ./node_modules/@loomkeep/shared/package.json
COPY --from=build /app/packages/shared/dist ./node_modules/@loomkeep/shared/dist
ENV PORT=3000
EXPOSE 3000
CMD ["node", "build"]
