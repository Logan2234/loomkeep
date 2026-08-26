import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthenticatedRequest } from "../auth/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Route guard restricting access to admin accounts. Runs after the global
 * `JwtAuthGuard` (which populates `request.user`), then reads the live role
 * from the DB — the JWT payload doesn't carry it, and a token issued before
 * the bootstrap promotion must still see the new grant.
 *
 * LK-C17: an admin account with no MFA method active is also rejected, with
 * a distinct "MFA_REQUIRED" message so the web app can show a "configure
 * your MFA" prompt instead of treating it as a plain non-admin 403. This is
 * checked live (not gated by a grace period) since there's no field
 * recording when the account became admin. Enforcement is skipped outside
 * `NODE_ENV=production` — requiring TOTP/email MFA (which burns the
 * transactional email quota) just to reach the admin panel locally/staging
 * would slow down dev for no real security benefit there. `GET /api/config`
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
      throw new ForbiddenException("Admin access required");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, mfaTotpEnabled: true, mfaEmailEnabled: true },
    });

    if (user?.role !== "ADMIN") {
      throw new ForbiddenException("Admin access required");
    }

    const mfaEnforced = this.config.get<string>("NODE_ENV") === "production";
    if (mfaEnforced && !user.mfaTotpEnabled && !user.mfaEmailEnabled) {
      throw new ForbiddenException("MFA_REQUIRED");
    }

    return true;
  }
}
