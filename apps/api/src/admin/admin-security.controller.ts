import { Controller, Get, Query } from "@nestjs/common";
import type {
  AdminSecuritySummaryDto,
  SecurityEventListResponseDto,
  SecurityEventType,
} from "@tracklore/shared";
import { SecurityEventService } from "../security/security-event.service";
import { AdminOnly } from "./admin-only.decorator";

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
  getSecuritySummary(): Promise<AdminSecuritySummaryDto> {
    return this.securityEvents.summary();
  }

  /** Sensitive account actions, filterable by type/identifier and paginated. */
  @Get("security")
  getSecurityEvents(
    @Query("type") type?: string,
    @Query("identifier") identifier?: string,
    @Query("page") page?: string,
  ): Promise<SecurityEventListResponseDto> {
    return this.securityEvents.list({
      type: SECURITY_EVENT_TYPES.includes(type as SecurityEventType)
        ? (type as SecurityEventType)
        : undefined,
      identifier: identifier?.trim() || undefined,
      page: page ? Number(page) : undefined,
    });
  }
}
