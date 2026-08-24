import { Injectable } from "@nestjs/common";
import type { Plan, UserEntitlement } from "@prisma/client";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Reads/writes `UserEntitlement` (docs/adr/0001-open-core-agpl.md). No row
 * is created at registration — every read/write here upserts a FREE default
 * on first touch instead, so a pre-existing account (or one created before
 * this table existed) never ends up without one.
 *
 * `hasPremium` only looks at `plan` for now — `expiresAt` isn't enforced
 * yet (no billing/webhook writes it), so an admin-granted PREMIUM plan
 * stays in effect until changed by hand.
 */
@Injectable()
export class EntitlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagsService,
  ) {}

  async getEntitlement(userId: string): Promise<UserEntitlement> {
    return this.prisma.userEntitlement.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async hasPremium(userId: string): Promise<boolean> {
    const entitlement = await this.getEntitlement(userId);
    return entitlement.plan === "PREMIUM";
  }

  /**
   * The premium check every enforcement point should actually call: `false`
   * as long as the `premium-features` Unleash flag isn't turned on (no CGV
   * yet — see docs/adr/0001-open-core-agpl.md), regardless of `plan`, so
   * nobody is locked out of anything before the offering is legally ready.
   * `hasPremium` itself stays the raw plan check, used by the admin panel
   * and the `GET /users/me/entitlement` endpoint the web reads.
   */
  async isEffectivelyPremium(userId: string): Promise<boolean> {
    if (!this.flags.isEnabled("premium-features", false)) return true;
    return this.hasPremium(userId);
  }

  /** Admin-only write path (see AdminUsersController) — no billing behind it. */
  async setPlan(userId: string, plan: Plan): Promise<UserEntitlement> {
    return this.prisma.userEntitlement.upsert({
      where: { userId },
      create: { userId, plan, source: "ADMIN_GRANT", grantedAt: new Date() },
      update: {
        plan,
        source: "ADMIN_GRANT",
        grantedAt: plan === "PREMIUM" ? new Date() : null,
      },
    });
  }
}
