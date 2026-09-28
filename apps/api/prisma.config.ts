import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: "postgresql://tracklore:tracklore@localhost:5433/tracklore?schema=public",
  },
  migrations: {
    seed: "ts-node -r tsconfig-paths/register prisma/seed.ts",
  },
});
