import { ErrorCode } from "@loomkeep/shared";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { HttpStatus, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyRequest } from "fastify";
import { createHmac } from "node:crypto";
import { AppException } from "../common/app.exception";
import { secretsMatch } from "../common/secret-compare.util";

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
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { rawBody?: Buffer }>();

    const secret = this.config.get<string>(
      "QUACKBACK_CHANGELOG_WEBHOOK_SECRET",
    );
    const signatureHeader = request.headers["x-quackback-signature"];
    const timestampHeader = request.headers["x-quackback-timestamp"];

    if (
      !secret ||
      typeof signatureHeader !== "string" ||
      typeof timestampHeader !== "string" ||
      !request.rawBody
    ) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.NewsletterWebhookUnauthorized,
      );
    }

    const age = Math.abs(
      Math.floor(Date.now() / 1000) - Number(timestampHeader),
    );

    if (!Number.isFinite(age) || age > MAX_CLOCK_SKEW_SECONDS) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.NewsletterWebhookUnauthorized,
      );
    }

    const expected = createHmac("sha256", secret)
      .update(`${timestampHeader}.${request.rawBody.toString("utf8")}`)
      .digest("hex");
    const provided = signatureHeader.replace(/^sha256=/, "");

    if (!secretsMatch(expected, provided)) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.NewsletterWebhookUnauthorized,
      );
    }

    return true;
  }
}
