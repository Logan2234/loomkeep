import { ErrorCode } from "@loomkeep/shared";
import { type CanActivate, HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../common/app.exception";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { isSocialEnabled } from "./social.config";

/**
 * Gates every social endpoint behind the runtime SOCIAL_ENABLED flag. Throws
 * 404 (not 403) when disabled so a self-host install doesn't even advertise the
 * social surface. Runs after the global JwtAuthGuard.
 */
@Injectable()
export class SocialFeatureGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly flags: FeatureFlagsService,
  ) {}

  canActivate(): boolean {
    if (!isSocialEnabled(this.config, this.flags)) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.SocialFeatureDisabled,
      );
    }

    return true;
  }
}
