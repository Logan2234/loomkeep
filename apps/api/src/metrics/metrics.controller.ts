import { Controller, Get, Header, UseGuards } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import { Registry } from "prom-client";
import { Public } from "../auth/decorators/public.decorator";
import { MetricsGuard } from "./metrics.guard";
import { MetricsService } from "./metrics.service";

/**
 * Prometheus scrape endpoint (see docker/observability/prometheus.yml).
 * `@Public()` because the collector has no user session — MetricsGuard's
 * shared secret is what stands in for one.
 */
@Public()
@UseGuards(MetricsGuard)
@Controller("metrics")
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header("Content-Type", Registry.PROMETHEUS_CONTENT_TYPE)
  @ApiExcludeEndpoint()
  scrape(): Promise<string> {
    return this.metrics.render();
  }
}
