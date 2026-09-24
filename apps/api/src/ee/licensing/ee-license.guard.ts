import { ErrorCode } from "@loomkeep/shared";
import { type CanActivate, HttpStatus, Injectable } from "@nestjs/common";
import { AppException } from "../../common/app.exception";
import { LicenseService } from "./license.service";

/**
 * Put on every `ee/` controller. 404 rather than 403 on an unlicensed
 * instance, like SocialFeatureGuard: the routes behave as if absent.
 */
@Injectable()
export class EeLicenseGuard implements CanActivate {
  constructor(private readonly license: LicenseService) {}

  canActivate(): boolean {
    if (!this.license.isActive()) {
      throw new AppException(HttpStatus.NOT_FOUND, ErrorCode.EeUnlicensed);
    }

    return true;
  }
}
