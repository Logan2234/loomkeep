import {
  ErrorCode,
  type AdminPushBroadcastResponseDto,
  type AdminPushDeviceDto,
  type AdminPushSendResponseDto,
  type AdminPushSummaryDto,
} from "@loomkeep/shared";
import { Body, Controller, Get, HttpStatus, Post, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import { AppException } from "../common/app.exception";
import { PushService } from "../notifications/push.service";
import { PrismaService } from "../prisma/prisma.service";
import { AdminOnly } from "./admin-only.decorator";
import { groupByUserAgentFamily } from "./admin-push.util";
import { AdminPushBroadcastResultResponseDto } from "./dto/admin-push-broadcast-response.dto";
import { AdminPushDeviceResponseDto } from "./dto/admin-push-device-response.dto";
import { AdminPushSendResultResponseDto } from "./dto/admin-push-send-response.dto";
import { AdminPushSummaryResponseDto } from "./dto/admin-push-summary-response.dto";
import { SendAdminBroadcastPushDto } from "./dto/send-admin-broadcast-push.dto";
import { SendAdminTestPushDto } from "./dto/send-admin-test-push.dto";

/** Push administration: per-account test sends and instance-wide broadcasts. */
@AdminOnly()
@Controller("admin")
export class AdminPushController {
  constructor(
    private readonly push: PushService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Instance-wide push reach, for the header of the Communications "Push" tab.
   * Active subscriptions only — a subscription the push service rejects is
   * deleted on the spot (see `PushService.sendToUserDetailed`), so there is no
   * dead-subscription count to report against it.
   */
  @Get("push/summary")
  @ApiOkResponse({ type: AdminPushSummaryResponseDto })
  async getPushSummary(): Promise<AdminPushSummaryDto> {
    const [rows, accounts] = await Promise.all([
      this.prisma.pushSubscription.findMany({ select: { userAgent: true } }),
      this.prisma.pushSubscription.findMany({
        distinct: ["userId"],
        select: { userId: true },
      }),
    ]);

    return {
      subscriptions: rows.length,
      accounts: accounts.length,
      byUserAgent: groupByUserAgentFamily(rows.map((r) => r.userAgent)),
    };
  }

  /** Devices the account matching `email` has an active push subscription on. */
  @Get("push/devices")
  @ApiOkResponse({ type: AdminPushDeviceResponseDto, isArray: true })
  async listPushDevices(
    @Query("email") email: string,
  ): Promise<AdminPushDeviceDto[]> {
    const user = await this.findUserByEmail(email);
    const devices = await this.push.listSubscriptions(user.id);
    return devices.map((d) => ({
      id: d.id,
      userAgent: d.userAgent,
      createdAt: d.createdAt.toISOString(),
    }));
  }

  /** Sends a sample push to every device of the account matching `email`. */
  @Post("push/test")
  @ApiCreatedResponse({ type: AdminPushSendResultResponseDto })
  async sendAdminTestPush(
    @Body() dto: SendAdminTestPushDto,
  ): Promise<AdminPushSendResponseDto> {
    const user = await this.findUserByEmail(dto.email);
    const devices = await this.push.listSubscriptions(user.id);

    const results = await this.push.sendToUserDetailed(user.id, {
      title: dto.title?.trim() || "Loomkeep (admin)",
      body:
        dto.body?.trim() ||
        "Ceci est une notification de test envoyée depuis le panel admin.",
      url: "/",
    });

    return { subscriptionCount: devices.length, results };
  }

  /** Sends one push to every device subscribed on the instance, across every account. */
  @Post("push/broadcast")
  @ApiCreatedResponse({ type: AdminPushBroadcastResultResponseDto })
  async broadcastAdminPush(
    @Body() dto: SendAdminBroadcastPushDto,
  ): Promise<AdminPushBroadcastResponseDto> {
    const subscribed = await this.prisma.pushSubscription.findMany({
      distinct: ["userId"],
      select: { userId: true },
    });

    const perAccount = await Promise.all(
      subscribed.map(({ userId }) =>
        this.push.sendToUserDetailed(userId, {
          title: dto.title?.trim() || "Loomkeep (admin)",
          body:
            dto.body?.trim() ||
            "Message envoyé à tous les comptes depuis le panel admin.",
          url: "/",
        }),
      ),
    );

    const results = perAccount.flat();
    return {
      accountCount: subscribed.length,
      deviceCount: results.length,
      successCount: results.filter((r) => r.ok).length,
      failureCount: results.filter((r) => !r.ok).length,
    };
  }

  private async findUserByEmail(email: string): Promise<{ id: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.AdminAccountNotFound,
      );
    return user;
  }
}
