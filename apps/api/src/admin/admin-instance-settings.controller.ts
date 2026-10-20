import type { InstanceSettingsDto } from "@loomkeep/shared";
import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { InstanceSettingsResponseDto } from "../instance-settings/dto/instance-settings-response.dto";
import { UpdateInstanceSettingsRequestDto } from "../instance-settings/dto/update-instance-settings.dto";
import { InstanceSettingsService } from "../instance-settings/instance-settings.service";
import { AdminOnly } from "./admin-only.decorator";

/** Instance-wide feature switches and public API limits. */
@AdminOnly()
@Controller("admin/instance-settings")
export class AdminInstanceSettingsController {
  constructor(private readonly settings: InstanceSettingsService) {}

  @Get()
  @ApiOkResponse({ type: InstanceSettingsResponseDto })
  get(): InstanceSettingsDto {
    return this.settings.toDto();
  }

  @Patch()
  @ApiOkResponse({ type: InstanceSettingsResponseDto })
  update(
    @Body() body: UpdateInstanceSettingsRequestDto,
  ): Promise<InstanceSettingsDto> {
    return this.settings.update(body);
  }
}
