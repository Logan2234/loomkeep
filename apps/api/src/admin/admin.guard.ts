import { ErrorCode } from "@loomkeep/shared/catalog";
import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthenticatedRequest } from "../auth/decorators/current-user.decorator";
import { AppException } from "../common/app.exception";
import { isHardened } from "../common/hardening.util";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Route guard restricting access to admin accounts. Runs after the global
 * `JwtAuthGuard` (which populates `request.user`), then reads the live role
 * from the DB — the JWT payload doesn't carry it, and a token issued before
 * the bootstrap promotion must still see the new grant.
 *
 * An admin account with no MFA method active is also rejected, with
 * a distinct ErrorCode.AuthMfaRequired code so the web app can show a
 * "configure your MFA" prompt instead of treating it as a plain non-admin
 * 403. This is checked live (not gated by a grace period) since there's no field
 * recording when the account became admin. Enforcement only applies to a
 * hardened instance (see isHardened: production, or served over https) —
 * requiring TOTP/email MFA (which burns the transactional email quota) just
 * to reach the admin panel in development or on a plain-http LAN instance
 * would slow things down for no real security benefit. `GET /api/config`
 * mirrors this (`adminMfaEnforced`) so the web app's own lockout screen
 * matches what the API will actually allow.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;

    if (!userId) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.AdminForbidden);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        mfaTotpEnabled: true,
        mfaEmailEnabled: true,
        // A security key or passkey is a second factor too (it's offered at
        // sign-in as one) — an admin protected by that alone is protected.
        _count: { select: { webauthnCredentials: true } },
      },
    });

    if (user?.role !== "ADMIN") {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.AdminForbidden);
    }

    const mfaEnforced = isHardened((key) => this.config.get<string>(key));

    if (
      mfaEnforced &&
      !user.mfaTotpEnabled &&
      !user.mfaEmailEnabled &&
      user._count.webauthnCredentials === 0
    ) {
      throw new AppException(HttpStatus.FORBIDDEN, ErrorCode.AuthMfaRequired);
    }

    return true;
  }
}
