import type { ApiV1MeDto } from "@loomkeep/shared";
import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { PublicApi } from "../../api-keys/public-api.decorator";
import type { JwtPayload } from "../../auth/decorators/current-user.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { ApiV1MeResponseDto } from "./me-response.dto";
import { MeV1Service } from "./me.service";

@PublicApi("Account", null)
@Controller({ path: "me", version: "1" })
export class MeV1Controller {
  constructor(private readonly me: MeV1Service) {}

  @Get()
  @ApiOperation({
    summary: "The account and key in use",
    description: "Any valid key can call it, whatever it was granted.",
  })
  @ApiOkResponse({ type: ApiV1MeResponseDto })
  get(@CurrentUser() user: JwtPayload): Promise<ApiV1MeDto> {
    return this.me.get(user.sub, user.apiKeyId);
  }
}
