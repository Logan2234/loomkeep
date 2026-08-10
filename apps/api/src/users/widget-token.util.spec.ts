import { createHmac } from "node:crypto";
import { signWidgetToken } from "./widget-token.util";

describe("signWidgetToken", () => {
  const secret = "test-secret";
  const payload = {
    sub: "user-1",
    email: "user@example.com",
    name: "User",
    exp: 1_700_000_300,
  };

  it("produces a three-part base64url JWT-shaped token", () => {
    const token = signWidgetToken(payload, secret);
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))).toBe(true);
  });

  it("encodes the header and payload verbatim", () => {
    const [header, body] = signWidgetToken(payload, secret).split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
      alg: "HS256",
      typ: "JWT",
    });
    expect(JSON.parse(Buffer.from(body, "base64url").toString())).toEqual(
      payload,
    );
  });

  it("signs with HMAC-SHA256 over header.body", () => {
    const token = signWidgetToken(payload, secret);
    const [header, body, signature] = token.split(".");
    const expected = createHmac("sha256", secret)
      .update(`${header}.${body}`)
      .digest("base64url");
    expect(signature).toBe(expected);
  });

  it("changes the signature when the secret differs", () => {
    const a = signWidgetToken(payload, secret);
    const b = signWidgetToken(payload, "other-secret");
    expect(a).not.toBe(b);
  });
});
