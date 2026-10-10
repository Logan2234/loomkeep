import { describe, expect, it } from "vitest";
import {
  createSentryEventFilter,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
} from "./observability";

describe("telemetry privacy", () => {
  it("cleans manually supplied secrets without losing diagnostic and correlation fields", () => {
    const event = {
      release: "a".repeat(40),
      environment: "staging",
      message:
        'Failed https://alice:password@example.com/auth?token=query-secret#private password="password-secret" user@example.com Bearer bearer-secret lk_api-secret postgresql://db-user:database-secret@db:5432/loomkeep?password=db-query-secret',
      exception: {
        values: [
          {
            value: "token=exception-secret",
            stacktrace: {
              frames: [
                { filename: "app:///deploy/dist/src/main.js", lineno: 42 },
              ],
            },
          },
        ],
      },
      user: {
        id: "user-123",
        email: "user@example.com",
        ip_address: "127.0.0.1",
      },
      request: {
        url: "/auth?private=query-secret",
        headers: { cookie: "cookie-secret" },
        data: { text: "body-secret" },
      },
      contexts: {
        loomkeep: { requestId: "req-123", route: "/auth", status: 500 },
        private: { accessToken: "context-secret", content: "private-message" },
      },
      extra: {
        nested: { password: "extra-secret", email: "user@example.com" },
      },
    };
    const cleaned = scrubSentryEvent(event);
    const payload = JSON.stringify(cleaned);

    for (const secret of [
      "query-secret",
      "password-secret",
      "user@example.com",
      "bearer-secret",
      "lk_api-secret",
      "exception-secret",
      "cookie-secret",
      "body-secret",
      "context-secret",
      "private-message",
      "extra-secret",
      "database-secret",
      "db-query-secret",
      "db-user",
    ]) {
      expect(payload).not.toContain(secret);
    }

    expect(cleaned.release).toBe(event.release);
    expect(cleaned.contexts.loomkeep.requestId).toBe("req-123");
    expect(cleaned.exception.values[0].stacktrace.frames[0].filename).toBe(
      "app:///deploy/dist/src/main.js",
    );
    expect(cleaned.request).toEqual({ url: "/auth" });
    expect(cleaned.user).toEqual({ id: "user-123" });
    expect(event.extra.nested.password).toBe("extra-secret");
  });

  it("cleans nested breadcrumbs, relative URL queries and cyclic manual context", () => {
    const data: Record<string, unknown> = {
      url: "/calendar.ics?token=calendar-secret",
      otp: "123456",
      message: "password=breadcrumb-secret",
    };
    data.loop = data;
    const cleaned = scrubSentryBreadcrumb({ category: "http", data });
    expect(cleaned.data.url).toBe("/calendar.ics");
    expect(JSON.stringify(cleaned)).not.toContain("calendar-secret");
    expect(JSON.stringify(cleaned)).not.toContain("123456");
    expect(JSON.stringify(cleaned)).not.toContain("breadcrumb-secret");
  });
});

describe("error capture deduplication", () => {
  it("retains both project observations but suppresses repeated captures within each client", () => {
    const api = createSentryEventFilter();
    const web = createSentryEventFilter();
    const event = { contexts: { loomkeep: { requestId: "req-1" } } };
    const error = new Error("crash");
    expect(api(event, { originalException: error })).not.toBeNull();
    expect(
      api(event, { originalException: new Error("same response") }),
    ).toBeNull();
    expect(web(event, { originalException: error })).not.toBeNull();
    // A global/unhandled handler may see the manually captured error again.
    expect(web({}, { originalException: error })).toBeNull();
    // Another failed request still counts even if it reuses the Error object.
    expect(
      api(
        { contexts: { loomkeep: { requestId: "req-2" } } },
        { originalException: error },
      ),
    ).not.toBeNull();
  });
});
