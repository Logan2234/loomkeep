import type { ApiKeyScope, ApiV1MeDto } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { ApiRateLimitService } from "../../api-keys/api-rate-limit.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class MeV1Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: ApiRateLimitService,
  ) {}

  async get(userId: string, apiKeyId: string | undefined): Promise<ApiV1MeDto> {
    const [user, apiKey, perMinute] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, username: true, displayName: true },
      }),
      apiKeyId
        ? this.prisma.apiKey.findUnique({
            where: { id: apiKeyId },
            select: { name: true, scopes: true, expiresAt: true },
          })
        : null,
      this.rateLimit.limitFor(userId),
    ]);

    return {
      user,
      apiKey: apiKey && {
        name: apiKey.name,
        scopes: apiKey.scopes as ApiKeyScope[],
        expiresAt: apiKey.expiresAt?.toISOString() ?? null,
      },
      rateLimit: { perMinute },
    };
  }
}
