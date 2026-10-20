import type { SessionTimerDto } from "@loomkeep/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { FinishSessionTimerDto } from "./dto/finish-session-timer.dto";
import { SessionTimerResponseDto } from "./dto/session-timer-response.dto";
import { StartSessionTimerDto } from "./dto/start-session-timer.dto";
import { SessionTimerService } from "./session-timer.service";

@Controller("session-timer")
export class SessionTimerController {
  constructor(private readonly timers: SessionTimerService) {}

  @Get()
  @ApiOkResponse({ type: SessionTimerResponseDto })
  current(@CurrentUser() user: JwtPayload): Promise<SessionTimerDto | null> {
    return this.timers.current(user.sub);
  }

  @Post()
  @ApiCreatedResponse({ type: SessionTimerResponseDto })
  start(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StartSessionTimerDto,
  ): Promise<SessionTimerDto> {
    return this.timers.start(user.sub, dto);
  }

  @Patch("pause")
  @ApiOkResponse({ type: SessionTimerResponseDto })
  pause(@CurrentUser() user: JwtPayload): Promise<SessionTimerDto> {
    return this.timers.pause(user.sub);
  }

  @Patch("resume")
  @ApiOkResponse({ type: SessionTimerResponseDto })
  resume(@CurrentUser() user: JwtPayload): Promise<SessionTimerDto> {
    return this.timers.resume(user.sub);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("finish")
  finish(
    @CurrentUser() user: JwtPayload,
    @Body() dto: FinishSessionTimerDto,
  ): Promise<void> {
    return this.timers.finish(user.sub, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete()
  cancel(@CurrentUser() user: JwtPayload): Promise<void> {
    return this.timers.cancel(user.sub);
  }
}
