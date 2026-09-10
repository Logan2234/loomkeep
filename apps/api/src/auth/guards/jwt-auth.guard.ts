import { ErrorCode } from "@loomkeep/shared";
import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { AppException } from "../../common/app.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { readAccessCookie } from "../auth-cookies";
import type {
  AuthenticatedRequest,
  JwtPayload,
} from "../decorators/current-user.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import {
  JWT_ACCESS_AUDIENCE,
  JWT_ALGORITHM,
  JWT_ISSUER,
} from "../jwt.constants";
import { SessionCacheService } from "../session-cache.service";

/** Global guard: every route requires an HttpOnly access-token cookie unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly sessionCache: SessionCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readAccessCookie(request);

    if (!token) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthMissingAccessToken,
      );
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
        algorithms: [JWT_ALGORITHM],
        issuer: JWT_ISSUER,
        audience: JWT_ACCESS_AUDIENCE,
      });
    } catch {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthInvalidAccessToken,
      );
    }

    // A token signed before `sid` existed (or any payload that somehow lacks
    // it) can't be checked against a live session — treat it as valid rather
    // than mass-rejecting every access token in flight at deploy time. It
    // ages out naturally within 15 minutes like any other access token.
    if (payload.sid) {
      await this.assertSessionLive(payload.sid);
    }

    request.user = payload;
    return true;
  }

  /**
   * Rejects when `sid` no longer names a live RefreshToken row — the DB-side
   * half of session revocation ("forcer la déconnexion" and friends), which
   * deleting the row alone doesn't cover since the access token itself stays
   * cryptographically valid for up to 15 more minutes. A short in-memory
   * cache (see SessionCacheService) avoids a database round trip on every
   * request for the common case where the session is still alive; explicit
   * invalidation from AuthService's revoke methods, logout, and
   * resetPassword keeps a forced logout effective immediately instead of
   * waiting out the cache.
   */
  private async assertSessionLive(sessionId: string): Promise<void> {
    if (this.sessionCache.isKnownLive(sessionId)) return;

    const session = await this.prisma.refreshToken.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!session) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthInvalidAccessToken,
      );
    }

    this.sessionCache.markLive(sessionId);
  }
}
