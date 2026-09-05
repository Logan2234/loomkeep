import { ErrorCode } from "@loomkeep/shared";
import { type CanActivate, HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../common/app.exception";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { isGamificationEnabled } from "./gamification.config";

/**
 * Gates a gamification-dependent endpoint behind the runtime
 * GAMIFICATION_ENABLED flag. Exact copy of `SocialFeatureGuard`'s pattern:
 * 404 (not 403) when disabled, so a deployment that turned gamification off
 * doesn't even advertise the endpoint exists.
 */
@Injectable()
export class GamificationFeatureGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly flags: FeatureFlagsService,
  ) {}

  canActivate(): boolean {
    if (!isGamificationEnabled(this.config, this.flags)) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.GamificationFeatureDisabled,
      );
    }

    return true;
  }
}
