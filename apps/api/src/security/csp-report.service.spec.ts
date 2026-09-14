import { vi } from "vitest";
import { CspReportService } from "./csp-report.service";

vi.mock("@sentry/node", () => ({ captureMessage: vi.fn() }));

function legacy(overrides: Record<string, string> = {}) {
  return {
    "csp-report": {
      "effective-directive": "script-src-elem",
      "blocked-uri": "https://evil.example/x.js",
      "document-uri": "https://loomkeep.app/app/media/series/42",
      ...overrides,
    },
  };
}

describe("CspReportService", () => {
  it("reports a legacy csp-report body once per distinct violation", () => {
    const service = new CspReportService();
    const notify = vi.fn();

    service.record(legacy(), notify);
    service.record(legacy(), notify);

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith({
      directive: "script-src-elem",
      blockedUri: "https://evil.example/x.js",
      documentUri: "https://loomkeep.app/app/media/series/42",
    });
  });

  it("reads the Reporting API envelope, including its array form", () => {
    const service = new CspReportService();
    const notify = vi.fn();

    service.record(
      [
        {
          type: "csp-violation",
          body: {
            effectiveDirective: "style-src",
            blockedURL: "https://cdn.example/a.css",
            documentURL: "https://loomkeep.app/app",
          },
        },
      ],
      notify,
    );

    expect(notify).toHaveBeenCalledWith({
      directive: "style-src",
      blockedUri: "https://cdn.example/a.css",
      documentUri: "https://loomkeep.app/app",
    });
  });

  it("drops the query string, which can carry a reset or calendar token", () => {
    const service = new CspReportService();
    const notify = vi.fn();

    service.record(
      legacy({
        "document-uri": "https://loomkeep.app/reset-password?token=secret",
      }),
      notify,
    );

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        documentUri: "https://loomkeep.app/reset-password",
      }),
    );
  });

  it("treats a different directive or page as its own violation", () => {
    const service = new CspReportService();
    const notify = vi.fn();

    service.record(legacy(), notify);
    service.record(legacy({ "effective-directive": "img-src" }), notify);

    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("ignores a body it cannot make sense of, rather than throwing", () => {
    const service = new CspReportService();
    const notify = vi.fn();

    for (const body of [
      null,
      undefined,
      "nope",
      {},
      { "csp-report": {} },
      [],
    ]) {
      expect(() => service.record(body, notify)).not.toThrow();
    }

    expect(notify).not.toHaveBeenCalled();
  });
});
