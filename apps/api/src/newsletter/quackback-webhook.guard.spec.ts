import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { QuackbackWebhookGuard } from "./quackback-webhook.guard";

const SECRET = "test-signing-secret";

function sign(timestamp: string, rawBody: string, secret = SECRET): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

function contextFor(
  headers: Record<string, string | undefined>,
  rawBody?: Buffer,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers, rawBody }),
    }),
  } as unknown as ExecutionContext;
}

describe("QuackbackWebhookGuard", () => {
  const guard = new QuackbackWebhookGuard();
  const ORIGINAL_SECRET = process.env.QUACKBACK_CHANGELOG_WEBHOOK_SECRET;
  const rawBody = Buffer.from('{"id":"evt_1"}');
  const timestamp = String(Math.floor(Date.now() / 1000));

  beforeEach(() => {
    process.env.QUACKBACK_CHANGELOG_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    process.env.QUACKBACK_CHANGELOG_WEBHOOK_SECRET = ORIGINAL_SECRET;
  });

  it("allows a request with a valid signature", () => {
    const signature = sign(timestamp, rawBody.toString("utf8"));
    const context = contextFor(
      {
        "x-quackback-signature": signature,
        "x-quackback-timestamp": timestamp,
      },
      rawBody,
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it("accepts a signature prefixed with sha256=", () => {
    const signature = `sha256=${sign(timestamp, rawBody.toString("utf8"))}`;
    const context = contextFor(
      {
        "x-quackback-signature": signature,
        "x-quackback-timestamp": timestamp,
      },
      rawBody,
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const signature = sign(timestamp, rawBody.toString("utf8"), "wrong-secret");
    const context = contextFor(
      {
        "x-quackback-signature": signature,
        "x-quackback-timestamp": timestamp,
      },
      rawBody,
    );
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects a signature for a different body (tampered payload)", () => {
    const signature = sign(timestamp, '{"id":"evt_TAMPERED"}');
    const context = contextFor(
      {
        "x-quackback-signature": signature,
        "x-quackback-timestamp": timestamp,
      },
      rawBody,
    );
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects a timestamp older than 5 minutes", () => {
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 301);
    const signature = sign(staleTimestamp, rawBody.toString("utf8"));
    const context = contextFor(
      {
        "x-quackback-signature": signature,
        "x-quackback-timestamp": staleTimestamp,
      },
      rawBody,
    );
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects a missing signature header", () => {
    const context = contextFor({ "x-quackback-timestamp": timestamp }, rawBody);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects when rawBody wasn't captured", () => {
    const signature = sign(timestamp, rawBody.toString("utf8"));
    const context = contextFor(
      {
        "x-quackback-signature": signature,
        "x-quackback-timestamp": timestamp,
      },
      undefined,
    );
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("fails closed when QUACKBACK_CHANGELOG_WEBHOOK_SECRET isn't configured", () => {
    delete process.env.QUACKBACK_CHANGELOG_WEBHOOK_SECRET;
    const signature = sign(timestamp, rawBody.toString("utf8"));
    const context = contextFor(
      {
        "x-quackback-signature": signature,
        "x-quackback-timestamp": timestamp,
      },
      rawBody,
    );
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
