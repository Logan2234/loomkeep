import type { ApiKeyScope } from "@loomkeep/shared";
import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

// Same trade-off as SessionCacheService: spares a query on every request,
// while revoke() evicts the key explicitly so it stops working at once.
const CACHE_TTL_MS = 30_000;

// lastUsedAt/lastUsedIp only feed the settings list; a write per request
// would turn every API read into a database write.
const TOUCH_INTERVAL_MS = 60_000;

export interface ApiKeyPrincipal {
  keyId: string;
  userId: string;
  email: string;
  scopes: ApiKeyScope[];
  expiresAt: Date | null;
}

export function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** Resolves the secret of an `Authorization: Bearer lk_…` header to its key. */
@Injectable()
export class ApiKeyAuthService {
  private readonly cache = new Map<
    string,
    { principal: ApiKeyPrincipal; until: number }
  >();

  private readonly touchedAt = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  async authenticate(
    secret: string,
    ip: string | undefined,
  ): Promise<ApiKeyPrincipal | null> {
    const principal = await this.lookup(hashApiKey(secret));
    if (!principal) return null;
    if (principal.expiresAt && principal.expiresAt <= new Date()) return null;

    await this.touch(principal.keyId, ip);
    return principal;
  }

  invalidate(keyId: string): void {
    for (const [hash, entry] of this.cache) {
      if (entry.principal.keyId === keyId) this.cache.delete(hash);
    }

    this.touchedAt.delete(keyId);
  }

  private async lookup(tokenHash: string): Promise<ApiKeyPrincipal | null> {
    const cached = this.cache.get(tokenHash);
    if (cached && cached.until > Date.now()) return cached.principal;

    const key = await this.prisma.apiKey.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        scopes: true,
        expiresAt: true,
        user: { select: { email: true } },
      },
    });

    if (!key) {
      this.cache.delete(tokenHash);
      return null;
    }

    const principal: ApiKeyPrincipal = {
      keyId: key.id,
      userId: key.userId,
      email: key.user.email,
      scopes: key.scopes as ApiKeyScope[],
      expiresAt: key.expiresAt,
    };
    this.cache.set(tokenHash, { principal, until: Date.now() + CACHE_TTL_MS });
    return principal;
  }

  private async touch(keyId: string, ip: string | undefined): Promise<void> {
    const now = Date.now();
    if (now - (this.touchedAt.get(keyId) ?? 0) < TOUCH_INTERVAL_MS) return;
    this.touchedAt.set(keyId, now);

    // updateMany: a key revoked between lookup and here is simply skipped.
    await this.prisma.apiKey.updateMany({
      where: { id: keyId },
      data: { lastUsedAt: new Date(now), lastUsedIp: ip ?? null },
    });
  }
}
