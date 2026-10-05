import { API_KEY_PREFIX, ErrorCode, readScope } from "@loomkeep/shared";
import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import {
  API_KEY_ACCESS_KEY,
  type ApiKeyAccess,
} from "../../api-keys/api-key-access.decorator";
import { ApiKeyAuthService } from "../../api-keys/api-key-auth.service";
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
import { isSessionLive } from "../session-live.util";

/**
 * Global guard: every route requires an HttpOnly access-token cookie unless
 * marked @Public(). Without a cookie, an `Authorization: Bearer lk_…` API key
 * is accepted, but only on routes marked @AllowApiKey().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly sessionCache: SessionCacheService,
    private readonly apiKeys: ApiKeyAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // A global APP_GUARD runs for every context type, not just HTTP routes —
    // EventsGateway's @SubscribeMessage handlers hit this too. Its own
    // socket already went through the equivalent check once already, at the
    // connection handshake (EventsGateway.handleConnection reads the same
    // cookie itself, since a WS message context has no HTTP request to read
    // it from — context.switchToHttp().getRequest() here returns something
    // that isn't a real request, which crashed reading its `.headers`).
    if (context.getType() !== "http") return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readAccessCookie(request);

    const authorization = request.headers.authorization;

    if (!token && authorization?.startsWith("Bearer ")) {
      await this.authenticateApiKey(
        context,
        request,
        authorization.slice("Bearer ".length),
      );
      return true;
    }

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

  private async authenticateApiKey(
    context: ExecutionContext,
    request: AuthenticatedRequest,
    secret: string,
  ): Promise<void> {
    const principal = secret.startsWith(API_KEY_PREFIX)
      ? await this.apiKeys.authenticate(secret, request.ip)
      : null;

    if (!principal) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthInvalidApiKey,
      );
    }

    const access = this.reflector.getAllAndOverride<ApiKeyAccess | undefined>(
      API_KEY_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const granted =
      access !== undefined &&
      (access.resource === null ||
        principal.scopes.includes(readScope(access.resource)));

    if (!granted) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.AuthApiKeyForbidden,
      );
    }

    request.user = {
      sub: principal.userId,
      email: principal.email,
      apiKeyId: principal.keyId,
    };
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
   * waiting out the cache — EventsGateway additionally force-disconnects any
   * live socket for that session at the same moment, since a WS connection
   * otherwise wouldn't notice a revocation until this cache entry expired.
   */
  private async assertSessionLive(sessionId: string): Promise<void> {
    if (!(await isSessionLive(this.prisma, this.sessionCache, sessionId))) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AuthInvalidAccessToken,
      );
    }
  }
}
