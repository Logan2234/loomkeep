import type {
  InstanceDomainAccountsDto,
  InstanceSettingsDto,
} from "@loomkeep/shared/contracts";
import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { RequireRecentAuth } from "../auth/recent-auth.guard";
import {
  InstanceDomainAccountsResponseDto,
  InstanceSettingsResponseDto,
} from "../instance-settings/dto/instance-settings-response.dto";
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

  /** Accounts that keep each domain enabled, shown beside its switch. */
  @Get("domain-accounts")
  @ApiOkResponse({ type: InstanceDomainAccountsResponseDto })
  domainAccounts(): Promise<InstanceDomainAccountsDto> {
    return this.settings.domainAccounts();
  }

  @RequireRecentAuth()
  @Patch()
  @ApiOkResponse({ type: InstanceSettingsResponseDto })
  update(
    @Body() body: UpdateInstanceSettingsRequestDto,
  ): Promise<InstanceSettingsDto> {
    return this.settings.update(body);
  }
}
