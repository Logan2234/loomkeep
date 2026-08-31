import type {
  AdminSecuritySummaryDto,
  PagedResult,
  SecurityEventDto,
  SecurityEventType,
} from "@loomkeep/shared";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { PagedResponseDto } from "../common/dto/paged-response.dto";
import { parsePageQuery } from "../common/pagination.util";
import {
  SECURITY_EVENT_PAGE_SIZE,
  SecurityEventService,
} from "../security/security-event.service";
import { AdminOnly } from "./admin-only.decorator";
import { AdminSecuritySummaryResponseDto } from "./dto/admin-security-summary-response.dto";
import { SecurityEventResponseDto } from "./dto/security-event-response.dto";

const SECURITY_EVENT_TYPES: SecurityEventType[] = [
  "USER_REGISTERED",
  "USER_DELETED",
  "EMAIL_CHANGED",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET",
  "LOGIN_FAILED",
];

/** Sensitive account actions log (registration, deletion, credential changes, failed logins). */
@AdminOnly()
@Controller("admin")
export class AdminSecurityController {
  constructor(private readonly securityEvents: SecurityEventService) {}

  /** Failed-login pressure over 24 h / 7 j / 30 j, for the page header. */
  @Get("security/summary")
  @ApiOkResponse({ type: AdminSecuritySummaryResponseDto })
  getSecuritySummary(): Promise<AdminSecuritySummaryDto> {
    return this.securityEvents.summary();
  }

  /** Sensitive account actions, filterable by type/identifier and paginated. */
  @Get("security")
  @ApiOkResponse({ type: PagedResponseDto(SecurityEventResponseDto) })
  getSecurityEvents(
    @Query("type") type?: string,
    @Query("identifier") identifier?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ): Promise<PagedResult<SecurityEventDto>> {
    const parsed = parsePageQuery(page, limit, SECURITY_EVENT_PAGE_SIZE);
    return this.securityEvents.list({
      type: SECURITY_EVENT_TYPES.includes(type as SecurityEventType)
        ? (type as SecurityEventType)
        : undefined,
      identifier: identifier?.trim() || undefined,
      page: parsed.page,
      limit: parsed.limit,
    });
  }
}
