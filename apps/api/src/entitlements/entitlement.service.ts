import { FeatureFlag } from "@loomkeep/shared/catalog";
import { type LicenseStatusDto } from "@loomkeep/shared/contracts";
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
 * A PREMIUM plan ends at `expiresAt` when one is set (an admin grant can
 * carry one; no billing writes it yet), and lasts until changed by hand
 * otherwise.
 */
@Injectable()
export class EntitlementService {
  private instancePremium: () => boolean = () => false;
  private licenseStatus: () => LicenseStatusDto | null = () => null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagsService,
  ) {}

  /**
   * Lets the self-host license (ee/licensing, LICENSE-EE) make every account
   * of the instance premium, without the AGPL core importing ee/: ee/ hands
   * its check in here at startup. Without ee/, no account is premium this way.
   */
  setInstancePremiumSource(source: () => boolean): void {
    this.instancePremium = source;
  }

  /**
   * Same inversion as `setInstancePremiumSource`, for the parsed license
   * itself (licensee/expiry/scope) rather than the boolean it grants — the
   * admin services page reads it through {@link getLicenseStatus} without
   * the core importing ee/. Null without ee/, or without a valid key.
   */
  setLicenseStatusSource(source: () => LicenseStatusDto | null): void {
    this.licenseStatus = source;
  }

  getLicenseStatus(): LicenseStatusDto | null {
    return this.licenseStatus();
  }

  async getEntitlement(userId: string): Promise<UserEntitlement> {
    return this.prisma.userEntitlement.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async hasPremium(userId: string, now = new Date()): Promise<boolean> {
    if (this.instancePremium()) return true;
    return effectivePlan(await this.getEntitlement(userId), now) === "PREMIUM";
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
    if (!this.flags.isEnabled(FeatureFlag.PREMIUM_FEATURES, false)) return true;
    return this.hasPremium(userId);
  }

  /**
   * Admin-only write path (see AdminUsersController) — no billing behind it.
   * `expiresAt` ends a PREMIUM grant (null: no end); FREE never keeps one.
   */
  async setPlan(
    userId: string,
    plan: Plan,
    expiresAt: Date | null = null,
  ): Promise<UserEntitlement> {
    const until = plan === "PREMIUM" ? expiresAt : null;
    return this.prisma.userEntitlement.upsert({
      where: { userId },
      create: {
        userId,
        plan,
        source: "ADMIN_GRANT",
        grantedAt: new Date(),
        expiresAt: until,
      },
      update: {
        plan,
        source: "ADMIN_GRANT",
        grantedAt: plan === "PREMIUM" ? new Date() : null,
        expiresAt: until,
      },
    });
  }
}

/** The plan in force: a PREMIUM one past its `expiresAt` is over. */
export function effectivePlan(
  entitlement: Pick<UserEntitlement, "plan" | "expiresAt">,
  now = new Date(),
): Plan {
  return entitlement.plan === "PREMIUM" &&
    (!entitlement.expiresAt || entitlement.expiresAt > now)
    ? "PREMIUM"
    : "FREE";
}
