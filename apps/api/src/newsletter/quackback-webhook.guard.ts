import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_CLOCK_SKEW_SECONDS = 300;

/**
 * Verifies Quackback webhook deliveries (see NewsletterWebhookController) via
 * the HMAC-SHA256 scheme documented on the webhook's signing-secret screen:
 * hex(HMAC-SHA256(`${timestamp}.${rawBody}`, secret)) in X-Quackback-Signature
 * (optionally prefixed "sha256="), timestamp in X-Quackback-Timestamp, rejected
 * if older than 5 minutes. Needs `rawBody: true` in main.ts's NestFactory
 * options — the signature is computed over the exact bytes Quackback sent,
 * not a re-serialization of the parsed body. Fails closed if the secret env
 * var isn't set, same convention as PublicStatsGuard.
 */
@Injectable()
export class QuackbackWebhookGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { rawBody?: Buffer }>();

    const secret = process.env.QUACKBACK_CHANGELOG_WEBHOOK_SECRET;
    const signatureHeader = request.headers["x-quackback-signature"];
    const timestampHeader = request.headers["x-quackback-timestamp"];

    if (
      !secret ||
      typeof signatureHeader !== "string" ||
      typeof timestampHeader !== "string" ||
      !request.rawBody
    ) {
      throw new UnauthorizedException();
    }

    const age = Math.abs(
      Math.floor(Date.now() / 1000) - Number(timestampHeader),
    );

    if (!Number.isFinite(age) || age > MAX_CLOCK_SKEW_SECONDS) {
      throw new UnauthorizedException();
    }

    const expected = createHmac("sha256", secret)
      .update(`${timestampHeader}.${request.rawBody.toString("utf8")}`)
      .digest("hex");
    const provided = signatureHeader.replace(/^sha256=/, "");

    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(provided);

    // Lengths must match before timingSafeEqual (it throws on mismatched
    // buffer sizes rather than returning false).
    if (
      expectedBuf.length !== providedBuf.length ||
      !timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
