import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  NotificationAction,
  signAction,
  verifyAction,
} from "./notification-action";

const CLAIMS = {
  action: NotificationAction.FOLLOW_ACCEPT,
  target: { followId: "follow-1" },
  subscriptionId: "sub-1",
  notificationId: "notif-1",
};
const NOW = Date.UTC(2026, 9, 28);
const DAY = 24 * 60 * 60 * 1000;

let previousSecret: string | undefined;

beforeEach(() => {
  previousSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = "access-secret";
});

afterEach(() => {
  process.env.JWT_ACCESS_SECRET = previousSecret;
});

describe("notification action tokens", () => {
  it("give back their claims for a week", () => {
    const token = signAction(CLAIMS, NOW);

    expect(verifyAction(token, NOW + 6 * DAY)).toEqual({
      ...CLAIMS,
      expiresAt: NOW + 7 * DAY,
    });
    expect(verifyAction(token, NOW + 7 * DAY)).toBeNull();
  });

  it("refuse a token whose claims were changed", () => {
    const [, sig] = signAction(CLAIMS, NOW).split(".");
    const forged = Buffer.from(
      JSON.stringify({
        ...CLAIMS,
        subscriptionId: "sub-2",
        expiresAt: NOW + DAY,
      }),
    ).toString("base64url");

    expect(verifyAction(`${forged}.${sig}`, NOW)).toBeNull();
  });

  it("refuse a token signed under another secret", () => {
    const token = signAction(CLAIMS, NOW);
    process.env.JWT_ACCESS_SECRET = "another-secret";

    expect(verifyAction(token, NOW)).toBeNull();
  });

  it("refuse something that isn't a token", () => {
    expect(verifyAction("", NOW)).toBeNull();
    expect(verifyAction("a.b.c", NOW)).toBeNull();
    expect(verifyAction("payload.c2ln", NOW)).toBeNull();
  });
});
