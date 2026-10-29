import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signWidgetToken, verifyWidgetToken } from "./widget-token";

const CLAIMS = { userId: "user-1", sessionId: "session-1" };

let previousSecret: string | undefined;

beforeEach(() => {
  previousSecret = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = "access-secret";
});

afterEach(() => {
  process.env.JWT_ACCESS_SECRET = previousSecret;
});

describe("home-screen widget tokens", () => {
  it("give back the account and session they were signed for", () => {
    expect(verifyWidgetToken(signWidgetToken(CLAIMS))).toEqual(CLAIMS);
  });

  it("refuse a token pointed at another account", () => {
    const [, sig] = signWidgetToken(CLAIMS).split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...CLAIMS, userId: "user-2" }),
    ).toString("base64url");

    expect(verifyWidgetToken(`${forged}.${sig}`)).toBeNull();
  });

  it("refuse a token signed with the access-token secret itself", () => {
    const payload = Buffer.from(JSON.stringify(CLAIMS)).toString("base64url");
    const sig = createHmac("sha256", "access-secret")
      .update(payload)
      .digest("base64url");

    expect(verifyWidgetToken(`${payload}.${sig}`)).toBeNull();
  });

  it("refuse anything that isn't a token", () => {
    expect(verifyWidgetToken("")).toBeNull();
    expect(verifyWidgetToken("a.b.c")).toBeNull();
  });
});
