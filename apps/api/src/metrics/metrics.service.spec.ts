import { MetricsService } from "./metrics.service";

describe("MetricsService", () => {
  it("exposes the Node runtime metrics Prometheus expects to find", async () => {
    const output = await new MetricsService().render();

    expect(output).toContain("process_cpu_user_seconds_total");
    expect(output).toContain("nodejs_eventloop_lag_seconds");
  });

  it("records a request under its route pattern, method and status", async () => {
    const metrics = new MetricsService();
    metrics.observeRequest("GET", "/api/media/:id", 200, 42);

    const output = await metrics.render();

    expect(output).toContain(
      'http_request_duration_seconds_count{method="GET",route="/api/media/:id",status_code="200"} 1',
    );
  });

  it("buckets an unmatched request instead of minting a series per URL", async () => {
    // A 404 on an arbitrary path carries no route pattern. Labelling those
    // with the raw URL would let a scan grow the registry without bound.
    const metrics = new MetricsService();
    metrics.observeRequest("GET", undefined, 404, 3);
    metrics.observeRequest("GET", undefined, 404, 5);

    const output = await metrics.render();

    expect(output).toContain(
      'http_request_duration_seconds_count{method="GET",route="unmatched",status_code="404"} 2',
    );
  });

  it("keeps each instance's registry to itself", async () => {
    // The service holds its own Registry rather than prom-client's global
    // default, so one test's observations can't leak into another's.
    const first = new MetricsService();
    first.observeRequest("GET", "/api/health", 200, 1);

    expect(await new MetricsService().render()).not.toContain("/api/health");
  });

  it("tracks the WebSocket connection gauge up and down", async () => {
    const metrics = new MetricsService();
    metrics.recordWsConnect();
    metrics.recordWsConnect();
    metrics.recordWsDisconnect();

    const output = await metrics.render();

    expect(output).toContain("ws_connections_active 1");
  });

  it("counts connection rejections by reason", async () => {
    const metrics = new MetricsService();
    metrics.recordWsRejection("no_cookie");
    metrics.recordWsRejection("no_cookie");
    metrics.recordWsRejection("session_revoked");

    const output = await metrics.render();

    expect(output).toContain(
      'ws_connection_rejections_total{reason="no_cookie"} 2',
    );
    expect(output).toContain(
      'ws_connection_rejections_total{reason="session_revoked"} 1',
    );
  });
});
