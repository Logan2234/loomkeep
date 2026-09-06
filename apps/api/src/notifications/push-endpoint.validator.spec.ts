import { isAllowedPushEndpoint } from "./push-endpoint.validator";

describe("isAllowedPushEndpoint", () => {
  it("accepts real browser push service endpoints", () => {
    expect(
      isAllowedPushEndpoint(
        "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
      ),
    ).toBe(true);
    expect(
      isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc123"),
    ).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/QGoi_abc")).toBe(
      true,
    );
    expect(
      isAllowedPushEndpoint("https://xyz.notify.windows.com/w/?token=abc"),
    ).toBe(true);
  });

  // LK-S02: an unrestricted endpoint reaches webpush.sendNotification() as
  // the request target, letting an authenticated user make the API server
  // POST to an arbitrary host (Docker-internal services, cloud metadata…).
  it("rejects an endpoint on a host that isn't a known push service", () => {
    expect(isAllowedPushEndpoint("https://db:5432/")).toBe(false);
    expect(
      isAllowedPushEndpoint("http://169.254.169.254/latest/meta-data/"),
    ).toBe(false);
    expect(isAllowedPushEndpoint("https://caddy:2019/config/")).toBe(false);
    expect(isAllowedPushEndpoint("https://evil.com/fcm.googleapis.com")).toBe(
      false,
    );
  });

  it("rejects a non-HTTPS scheme even on an otherwise allowed host", () => {
    expect(
      isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc123"),
    ).toBe(false);
  });

  it("rejects a malformed URL rather than throwing", () => {
    expect(isAllowedPushEndpoint("not-a-url")).toBe(false);
    expect(isAllowedPushEndpoint("")).toBe(false);
  });
});
