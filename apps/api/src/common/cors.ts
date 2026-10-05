import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { RATE_LIMIT_HEADERS } from "./rate-limit-headers";

type CorsOptions = NonNullable<
  Parameters<NestFastifyApplication["enableCors"]>[0]
>;

const PUBLIC_API_PATH = /^\/api\/v1(?:[/?]|$)/;

/**
 * The web app's CORS: its own origins only, with the session cookies. The
 * public API's: any origin, never credentials — it authenticates with a
 * bearer key, so a page elsewhere (the docs' "Try it" console, a browser
 * tool) can use it with a key, but can never ride a signed-in session.
 */
export function corsOptionsFor(
  url: string | undefined,
  webOrigins: string[],
): CorsOptions {
  if (url && PUBLIC_API_PATH.test(url)) {
    return {
      origin: "*",
      methods: ["GET", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type"],
      exposedHeaders: [
        RATE_LIMIT_HEADERS.retryAfter,
        RATE_LIMIT_HEADERS.limit,
        RATE_LIMIT_HEADERS.remaining,
        RATE_LIMIT_HEADERS.reset,
      ],
      credentials: false,
      optionsSuccessStatus: 204,
      maxAge: 3600,
      preflightContinue: false,
    };
  }

  return {
    origin: webOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    optionsSuccessStatus: 204,
    maxAge: 3600,
    credentials: true,
    // Retry-After is unreadable from JS on a cross-origin response
    // unless exposed: without it a 429 can only say "try again soon".
    exposedHeaders: ["Content-Disposition", RATE_LIMIT_HEADERS.retryAfter],
    preflightContinue: false,
  };
}
