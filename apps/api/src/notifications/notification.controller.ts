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
} from "@nestjs/common";
import type { NotificationFeedDto, PushPublicKeyDto } from "@loomkeep/shared";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
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
  publicKey(): PushPublicKeyDto {
    return { publicKey: this.push.publicKey() };
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
  async scan(@CurrentUser() user: JwtPayload): Promise<NotificationFeedDto> {
    await this.notifications.scan(user.sub);
    return this.notifications.feed(user.sub);
  }

  @Get()
  feed(@CurrentUser() user: JwtPayload): Promise<NotificationFeedDto> {
    return this.notifications.feed(user.sub);
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
}
