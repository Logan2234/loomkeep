import { ErrorCode, type SessionDto } from "@loomkeep/shared";
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AppException } from "../common/app.exception";
import { AuthService } from "./auth.service";
import type { JwtPayload } from "./decorators/current-user.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import { SessionResponseDto } from "./dto/session-response.dto";

/**
 * Manage the user's signed-in devices. Lives outside the (@Public) AuthController
 * so these routes go through the global JwtAuthGuard.
 */
@Controller("auth/sessions")
export class SessionsController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @ApiOkResponse({ type: SessionResponseDto, isArray: true })
  listSessions(@CurrentUser() payload: JwtPayload): Promise<SessionDto[]> {
    return this.authService.listSessions(payload.sub);
  }

  /** Revokes every other device, keeping the current one (identified by its jti). */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete()
  async revokeOthers(
    @CurrentUser() payload: JwtPayload,
    @Query("except") exceptJti?: string,
  ): Promise<void> {
    if (!exceptJti) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AuthMissingExceptParam,
      );
    }

    await this.authService.revokeOtherSessions(payload.sub, exceptJti);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(":id")
  async revokeSession(
    @CurrentUser() payload: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    await this.authService.revokeSession(payload.sub, id);
  }
}
