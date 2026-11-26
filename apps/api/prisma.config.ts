import { defineConfig } from "prisma/config";

export default defineConfig({
  // One file per owning module (prisma/schema/<module>.prisma); the
  // generators, datasource and shared enums live in schema/schema.prisma.
  schema: "prisma/schema",
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    // Kept beside the folder rather than inside it, where a multi-file
    // schema would otherwise look for them.
    path: "prisma/migrations",
    seed: "ts-node prisma/seed.ts",
  },
});
