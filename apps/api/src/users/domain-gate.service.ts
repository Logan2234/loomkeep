import { ForbiddenException, Injectable } from "@nestjs/common";
import { Domain } from "@loomkeep/shared";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Enforces `User.enabledDomains` server-side: a domain the user turned off is
 * not just hidden from the nav, it is unreachable. Called by the per-domain
 * search endpoints so a disabled domain returns 403 instead of results.
 */
@Injectable()
export class DomainGateService {
  constructor(private readonly prisma: PrismaService) {}

  /** Throws 403 unless the user keeps `domain` enabled. */
  async assertEnabled(userId: string, domain: Domain): Promise<void> {
    const enabled = await this.getEnabledDomains(userId);

    if (!enabled.includes(domain)) {
      throw new ForbiddenException(`Domain '${domain}' is disabled`);
    }
  }

  /** The domains this user currently keeps enabled. */
  async getEnabledDomains(userId: string): Promise<Domain[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { enabledDomains: true },
    });

    return user?.enabledDomains ?? [];
  }
}
