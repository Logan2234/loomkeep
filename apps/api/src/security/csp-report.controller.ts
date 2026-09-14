import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Logger } from "nestjs-pino";
import { Public } from "../auth/decorators/public.decorator";
import { CspReportService } from "./csp-report.service";

/**
 * Collector for the Content-Security-Policy violation reports the edge asks
 * browsers to send (see `report-uri` in docker/Caddyfile).
 *
 * The policy is still `Report-Only` — nothing is blocked. The point of this
 * endpoint is to find out what *would* break before switching to enforcement:
 * a Report-Only policy with nowhere to report to is inert, which is what it
 * was until now.
 *
 * `@Public()` by necessity — the browser posts these without credentials, and
 * from a page that may have no session at all. That makes it an unauthenticated
 * write endpoint, hence the tight throttle and the aggregation in
 * {@link CspReportService}: a single bad page reloading in a loop must not be
 * able to flood the logs or the error tracker.
 */
@Public()
@Controller("security")
export class CspReportController {
  constructor(
    private readonly reports: CspReportService,
    private readonly logger: Logger,
  ) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiExcludeEndpoint()
  @Post("csp-report")
  report(@Body() body: unknown): void {
    // No DTO validation: the payload shape differs between the legacy
    // `application/csp-report` body and the newer Reporting API envelope, and
    // browsers send fields we don't model. Rejecting on shape would lose the
    // very reports we want to see, so it's parsed defensively instead.
    this.reports.record(body, (violation) =>
      this.logger.warn({ csp: violation }, "CSP violation reported"),
    );
  }
}
