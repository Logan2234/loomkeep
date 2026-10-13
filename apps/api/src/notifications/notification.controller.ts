import {
  DEFAULT_PAGE_SIZE,
  type NotificationCountsDto,
  type NotificationDto,
  type NotificationFeedDto,
  type PagedResult,
  type PushDeviceCountDto,
  type PushPublicKeyDto,
} from "@loomkeep/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { parsePageQuery } from "../common/pagination.util";
import { NotificationCountsResponseDto } from "./dto/notification-counts-response.dto";
import { NotificationFeedResponseDto } from "./dto/notification-feed-response.dto";
import { NotificationResponseDto } from "./dto/notification-response.dto";
import { PushDeviceCountResponseDto } from "./dto/push-device-count-response.dto";
import { PushPublicKeyResponseDto } from "./dto/push-public-key-response.dto";
import { PushSubscriptionDto } from "./dto/push-subscription.dto";
import { NotificationService } from "./notification.service";
import { PushService } from "./push.service";

@Controller("notifications")
export class NotificationController {
  constructor(
    private readonly notifications: NotificationService,
    private readonly push: PushService,
  ) {}

  @Public()
  @Get("push/public-key")
  @ApiOkResponse({ type: PushPublicKeyResponseDto })
  publicKey(): PushPublicKeyDto {
    return { publicKey: this.push.publicKey() };
  }

  /** The account's push choices apply to every device: this says whether any receives them. */
  @Get("push/devices/count")
  @ApiOkResponse({ type: PushDeviceCountResponseDto })
  async pushDeviceCount(
    @CurrentUser() user: JwtPayload,
  ): Promise<PushDeviceCountDto> {
    return { count: await this.push.countSubscriptions(user.sub) };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("push/subscribe")
  async subscribe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: PushSubscriptionDto,
    @Headers("user-agent") userAgent?: string,
  ): Promise<void> {
    await this.push.subscribe(
      user.sub,
      dto.endpoint,
      dto.keys.p256dh,
      dto.keys.auth,
      userAgent,
    );
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("push/subscribe")
  async unsubscribe(
    @CurrentUser() user: JwtPayload,
    @Body("endpoint") endpoint: string,
  ): Promise<void> {
    await this.push.unsubscribe(user.sub, endpoint);
  }

  @Post("scan")
  @ApiCreatedResponse({ type: NotificationFeedResponseDto })
  async scan(@CurrentUser() user: JwtPayload): Promise<NotificationFeedDto> {
    await this.notifications.scan(user.sub);
    return this.notifications.feed(user.sub);
  }

  @Get()
  @ApiOkResponse({ type: NotificationFeedResponseDto })
  feed(@CurrentUser() user: JwtPayload): Promise<NotificationFeedDto> {
    return this.notifications.feed(user.sub);
  }

  /** The notifications page: every entry kept, read or not (`unread=true` for the unread ones). */
  @Get("history")
  @ApiOkResponse({ type: PagedResponseDto(NotificationResponseDto) })
  history(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("unread") unread?: string,
  ): Promise<PagedResult<NotificationDto>> {
    return this.notifications.history(
      user.sub,
      parsePageQuery(page, limit, DEFAULT_PAGE_SIZE),
      unread === "true",
    );
  }

  @Get("counts")
  @ApiOkResponse({ type: NotificationCountsResponseDto })
  counts(@CurrentUser() user: JwtPayload): Promise<NotificationCountsDto> {
    return this.notifications.counts(user.sub);
  }

  /** The bell or the notifications page was opened: the badge starts over. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("seen")
  async markSeen(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.notifications.markSeen(user.sub);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("read")
  async markAllRead(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.notifications.markAllRead(user.sub);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch(":id/read")
  async markRead(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    await this.notifications.markRead(user.sub, id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch(":id/unread")
  async markUnread(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    await this.notifications.markUnread(user.sub, id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(":id")
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
  ): Promise<void> {
    await this.notifications.remove(user.sub, id);
  }
}
