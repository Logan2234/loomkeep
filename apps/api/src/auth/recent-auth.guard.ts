import { ErrorCode, REAUTH_WINDOW_MS } from "@loomkeep/shared";
import {
  applyDecorators,
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
  SetMetadata,
  UseGuards,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppException } from "../common/app.exception";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedRequest } from "./decorators/current-user.decorator";

export const RECENT_AUTH_MAX_AGE = "recentAuthMaxAgeMs";

/**
 * Lets a sensitive action through only on a session whose owner proved it's
 * them less than `maxAgeMs` ago — at sign-in or through `POST /auth/reauth`.
 * A stolen session cookie then can't mint an API key or turn the second
 * factor off on its own.
 */
export const RequireRecentAuth = (maxAgeMs = REAUTH_WINDOW_MS) =>
  applyDecorators(
    SetMetadata(RECENT_AUTH_MAX_AGE, maxAgeMs),
    UseGuards(RecentAuthGuard),
  );

@Injectable()
export class RecentAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const maxAgeMs = this.reflector.get<number>(
      RECENT_AUTH_MAX_AGE,
      context.getHandler(),
    );
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = user?.sid
      ? await this.prisma.refreshToken.findUnique({
          where: { id: user.sid },
          select: { reauthenticatedAt: true },
        })
      : null;
    const confirmedAt = session?.reauthenticatedAt?.getTime();

    if (confirmedAt !== undefined && Date.now() - confirmedAt < maxAgeMs) {
      return true;
    }

    throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.AuthReauthRequired);
  }
}
