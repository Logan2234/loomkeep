import { Injectable } from "@nestjs/common";
import { Histogram, Registry, collectDefaultMetrics } from "prom-client";

/**
 * Technical metrics for Prometheus: Node/process internals plus one HTTP
 * latency histogram. Business figures deliberately stay out — those already
 * live in the admin dashboard, which reads them from Postgres rather than
 * from a 15s-resolution time series.
 *
 * Its own `Registry` rather than prom-client's global default, so nothing
 * registered by a library ends up on this endpoint by accident and tests can
 * build a throwaway instance.
 */
@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  private readonly httpDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request latency, by route and outcome",
    labelNames: ["method", "route", "status_code"] as const,
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  /**
   * Records one finished request. `route` must be the matched *pattern*
   * (`/api/media/:id`), never the concrete URL — one time series per
   * media id would make the registry grow with the catalog.
   */
  observeRequest(
    method: string,
    route: string | undefined,
    statusCode: number,
    durationMs: number,
  ): void {
    this.httpDuration.observe(
      {
        method,
        // No pattern means no route matched (a 404 on an arbitrary path);
        // bucketing those together is what keeps a scan from creating a
        // series per probed URL.
        route: route ?? "unmatched",
        status_code: statusCode,
      },
      durationMs / 1000,
    );
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }
}
