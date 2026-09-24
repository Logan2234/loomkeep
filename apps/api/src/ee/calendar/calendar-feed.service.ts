import type { CalendarTokenDto } from "@loomkeep/shared";
import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { AppException } from "../../common/app.exception";
import { EntitlementService } from "../../entitlements/entitlement.service";
import { LibraryService } from "../../library/library.service";
import { PrismaService } from "../../prisma/prisma.service";
import { buildCalendarIcs } from "./ics.util";

/**
 * The release calendar as an `.ics` subscription, fed through a per-user
 * token so calendar apps can poll it without signing in. Premium
 * (docs/adr/0001-open-core-agpl.md).
 */
@Injectable()
export class CalendarFeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
    private readonly library: LibraryService,
  ) {}

  /**
   * The feed for the account holding `token`, or null if none does. The
   * premium check is repeated here, not just at token issuance, so a
   * downgraded account's calendar app stops getting fed the moment its plan
   * changes, instead of forever on a token minted while premium.
   */
  async getCalendarIcs(token: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { calendarToken: token },
      select: { id: true },
    });

    if (!user || !(await this.entitlements.isEffectivelyPremium(user.id))) {
      return null;
    }

    return buildCalendarIcs(await this.library.getCalendar(user.id));
  }

  /**
   * The subscription token, generated on first call and stable afterwards —
   * `regenerateToken` revokes a previously shared link.
   */
  async getToken(userId: string): Promise<CalendarTokenDto> {
    await this.requirePremium(userId);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { calendarToken: true },
    });

    if (user.calendarToken) {
      return { token: user.calendarToken };
    }

    return this.issueToken(userId);
  }

  async regenerateToken(userId: string): Promise<CalendarTokenDto> {
    await this.requirePremium(userId);
    return this.issueToken(userId);
  }

  private async issueToken(userId: string): Promise<CalendarTokenDto> {
    const { calendarToken } = await this.prisma.user.update({
      where: { id: userId },
      data: { calendarToken: randomBytes(24).toString("base64url") },
      select: { calendarToken: true },
    });
    return { token: calendarToken! };
  }

  private async requirePremium(userId: string): Promise<void> {
    if (!(await this.entitlements.isEffectivelyPremium(userId))) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.UserPremiumRequired,
        undefined,
        "This feature is reserved for premium accounts",
      );
    }
  }
}
