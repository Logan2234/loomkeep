import { ErrorCode } from "@loomkeep/shared";
import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator";
import { AppException } from "../common/app.exception";
import { InstancePingRequestDto } from "./dto/instance-ping-request.dto";
import { InstancePingResponseDto } from "./dto/instance-ping-response.dto";
import { InstancePingService } from "./instance-ping.service";

/**
 * Where self-hosted instances' update checks land (UpdateCheckService's
 * INSTANCE_PING_URL): a permanent contract, since every released version
 * keeps calling it. Nothing about the caller is kept, not even in the logs
 * (logger.config.ts, docker/Caddyfile).
 */
@Public()
@Controller("instances")
export class InstancePingController {
  constructor(private readonly pings: InstancePingService) {}

  // An instance pings once a day: the budget only keeps one address from
  // inflating the count.
  @Throttle({ default: { limit: 10, ttl: 60 * 60 * 1000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: InstancePingResponseDto })
  @Post("ping")
  async ping(
    @Body() dto: InstancePingRequestDto,
  ): Promise<InstancePingResponseDto> {
    // 404 like SocialFeatureGuard: a self-host doesn't advertise the route.
    if (!this.pings.isReceiver()) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.AdminInstancePingsNotReceived,
      );
    }

    return { latestVersion: await this.pings.record(dto) };
  }
}
