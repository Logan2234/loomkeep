import type { EeStatusDto } from "@loomkeep/shared";
import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { Public } from "../../auth/decorators/public.decorator";
import { EeStatusResponseDto } from "./dto/ee-status-response.dto";
import { LicenseService } from "./license.service";

/** Lets the web lock the `ee/` screens on an unlicensed instance. */
@Controller("ee")
export class EeStatusController {
  constructor(private readonly license: LicenseService) {}

  @Public()
  @Get("status")
  @ApiOkResponse({ type: EeStatusResponseDto })
  status(): EeStatusDto {
    return { active: this.license.isActive() };
  }
}
