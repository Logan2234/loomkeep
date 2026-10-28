import { MESSAGE_TEXT_MAX_LENGTH } from "@loomkeep/shared";
import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { Public } from "../auth/decorators/public.decorator";
import { SENSITIVE_ACTION_THROTTLE } from "../common/throttle.constants";
import { NotificationActionService } from "./notification-action.service";

class NotificationActionDto {
  @IsString()
  @MaxLength(4096)
  token!: string;

  /** A direct reply's text, for the actions that send one. */
  @IsOptional()
  @IsString()
  @MaxLength(MESSAGE_TEXT_MAX_LENGTH)
  text?: string;
}

@Controller("notifications/actions")
export class NotificationActionController {
  constructor(private readonly actions: NotificationActionService) {}

  /** A button pressed on an Android notification: the app sends it without a session. */
  @Public()
  @Throttle(SENSITIVE_ACTION_THROTTLE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post()
  perform(@Body() dto: NotificationActionDto): Promise<void> {
    return this.actions.perform(dto.token, dto.text);
  }
}
