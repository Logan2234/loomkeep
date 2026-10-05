import { FeatureFlag } from "@loomkeep/shared";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EntitlementService } from "../../entitlements/entitlement.service";
import { FeatureFlagsService } from "../../feature-flags/feature-flags.service";
import {
  LICENSE_PUBLIC_KEY,
  type LicensePayload,
  isLicenseCurrent,
  verifyLicenseKey,
} from "./license-key";

/**
 * Whether this instance may run the `ee/` features (see LICENSE-EE), from the
 * `LOOMKEEP_LICENSE_KEY` it was started with.
 */
@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);
  private readonly license: LicensePayload | null;

  constructor(
    config: ConfigService,
    private readonly flags: FeatureFlagsService,
    entitlements: EntitlementService,
  ) {
    const key = config.get<string>("LOOMKEEP_LICENSE_KEY");
    this.license = key ? verifyLicenseKey(key, LICENSE_PUBLIC_KEY) : null;

    if (key && !this.license) {
      this.logger.warn("LOOMKEEP_LICENSE_KEY is not a valid license key");
    } else if (this.license) {
      this.logger.log(
        `Licensed to ${this.license.licensee} until ${this.license.expiresAt}` +
          (this.license.instanceWide ? ", every account premium" : ""),
      );
    }

    entitlements.setInstancePremiumSource(() => this.grantsInstancePremium());
    entitlements.setLicenseStatusSource(() => this.getStatus());
  }

  /**
   * Until the premium offer launches (the `premium-features` flag, see
   * EntitlementService#isEffectivelyPremium), nobody can buy a key yet, so
   * the `ee/` features stay on everywhere, as they were before moving there.
   */
  isActive(now = new Date()): boolean {
    if (!this.flags.isEnabled(FeatureFlag.PREMIUM_FEATURES, false)) return true;
    return this.license !== null && isLicenseCurrent(this.license, now);
  }

  /**
   * A self-host key makes every account premium, for as long as it is
   * current: a household runs one instance, it doesn't buy seats.
   */
  grantsInstancePremium(now = new Date()): boolean {
    return (
      this.license?.instanceWide === true && isLicenseCurrent(this.license, now)
    );
  }

  /** Parsed key details for the admin services page — null absent or invalid. */
  getStatus(now = new Date()): LicenseStatusDto | null {
    if (!this.license) return null;
    return {
      licensee: this.license.licensee,
      expiresAt: this.license.expiresAt,
      instanceWide: this.license.instanceWide === true,
      current: isLicenseCurrent(this.license, now),
    };
  }
}
