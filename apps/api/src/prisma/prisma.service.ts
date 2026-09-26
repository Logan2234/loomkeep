import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    // The pg driver ignores Prisma's `?schema=` query param, so extract it and
    // pass it to the adapter explicitly — otherwise every query defaults to the
    // `public` schema (this is what isolates the e2e suite in its own schema).
    // The adapter only qualifies the queries Prisma builds; the connection's
    // search_path is what points raw SQL (`$queryRaw`) at the same schema.
    const schema = connectionString
      ? (new URL(connectionString).searchParams.get("schema") ?? undefined)
      : undefined;
    const adapter = new PrismaPg(
      {
        connectionString,
        ...(schema ? { options: `-c search_path=${schema}` } : {}),
      },
      { schema },
    );

    super({
      adapter,
      log: ["info", "warn", "error"],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
