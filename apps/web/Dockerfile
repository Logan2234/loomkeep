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

# adapter-node output is self-contained: the runtime image only needs it.
FROM node:26-alpine@sha256:aadf416b2cdce311a8811ba3f0608a61b77dbf997500e2eafe781b51f6a0b019
WORKDIR /app
COPY --from=build /app/apps/web/build ./build
ENV PORT=3000
EXPOSE 3000
CMD ["node", "build"]
