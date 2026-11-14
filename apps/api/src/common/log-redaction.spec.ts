import type { IncomingMessage, ServerResponse } from "node:http";
import type { Options } from "pino-http";
import { describe, expect, it } from "vitest";
import { redactQuery, redactUrl } from "./log-redaction";
import { loggerOptions } from "./logger.config";

describe("redactUrl", () => {
  it("hides a feed token wherever it sits in the query", () => {
    expect(redactUrl("/api/library/calendar.ics?token=abc123")).toBe(
      "/api/library/calendar.ics?token=[redacted]",
    );
    expect(redactUrl("/api/social/activity.atom?lang=fr&token=abc&x=1")).toBe(
      "/api/social/activity.atom?lang=fr&token=[redacted]&x=1",
    );
    expect(redactUrl("/api/newsletter/unsubscribe/one-click?TOKEN=abc")).toBe(
      "/api/newsletter/unsubscribe/one-click?TOKEN=[redacted]",
    );
  });

  it("leaves every other parameter and path alone", () => {
    expect(redactUrl("/api/search?q=token=1&page=2")).toBe(
      "/api/search?q=token=1&page=2",
    );
    expect(redactUrl("/api/users/me/calendar-token")).toBe(
      "/api/users/me/calendar-token",
    );
    expect(redactUrl(undefined)).toBeUndefined();
  });
});

describe("redactQuery", () => {
  it("hides the secret parameter of a parsed query", () => {
    expect(redactQuery({ token: "abc", lang: "fr" })).toEqual({
      token: "[redacted]",
      lang: "fr",
    });
    expect(redactQuery(undefined)).toBeUndefined();
  });
});

describe("request logging", () => {
  const options = loggerOptions.pinoHttp as Options;
  const feedUrl = "/api/library/calendar.ics?token=s3cret-feed-token";

  it("serializes the request without its feed token", () => {
    const serialize = options.serializers?.req as (
      req: Record<string, unknown>,
    ) => Record<string, unknown>;

    const logged = serialize({
      method: "GET",
      url: feedUrl,
      query: { token: "s3cret-feed-token" },
      headers: {},
    });

    expect(JSON.stringify(logged)).not.toContain("s3cret-feed-token");
    expect(logged.url).toBe("/api/library/calendar.ics?token=[redacted]");
  });

  it("keeps the token out of the one-line request message", () => {
    const req = { method: "GET", url: feedUrl } as IncomingMessage;
    const res = { statusCode: 200 } as ServerResponse;

    expect(options.customSuccessMessage?.(req, res, 3)).toBe(
      "GET /api/library/calendar.ics?token=[redacted] -> 200",
    );
    expect(
      options.customErrorMessage?.(
        req,
        { statusCode: 401 } as ServerResponse,
        new Error("boom"),
      ),
    ).not.toContain("s3cret-feed-token");
  });
});
