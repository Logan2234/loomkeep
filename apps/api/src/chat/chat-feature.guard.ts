import { ErrorCode } from "@loomkeep/shared";
import { type CanActivate, HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppException } from "../common/app.exception";
import { isChatEnabled } from "./chat.config";

/** 404s every chat route while messages are off, like SocialFeatureGuard. */
@Injectable()
export class ChatFeatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    if (!isChatEnabled(this.config)) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.ChatFeatureDisabled,
      );
    }

    return true;
  }
}
