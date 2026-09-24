import type { AccountSecurityEventDto, PagedResult } from "@loomkeep/shared";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { DEFAULT_PAGE_SIZE, parsePageQuery } from "../common/pagination.util";
import { AccountSecurityEventResponseDto } from "./dto/account-security-event-response.dto";
import { SecurityEventService } from "./security-event.service";

/** The signed-in account's own security history — read-only. */
@Controller("auth/security-events")
export class AccountSecurityEventsController {
  constructor(private readonly securityEvents: SecurityEventService) {}

  @Get()
  @ApiOkResponse({ type: PagedResponseDto(AccountSecurityEventResponseDto) })
  list(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<PagedResult<AccountSecurityEventDto>> {
    const parsed = parsePageQuery(page, limit, DEFAULT_PAGE_SIZE);
    return this.securityEvents.listForAccount(
      user.sub,
      parsed.page,
      parsed.limit,
    );
  }
}
