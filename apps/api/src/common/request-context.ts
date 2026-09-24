import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  /** The client's address, as resolved by Fastify's `trustProxy` setting. */
  ip: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Makes the current request's client readable from anywhere down its call
 * chain (see `currentRequest`), so recording where a security event came from
 * doesn't mean threading the IP through every service signature.
 *
 * A `preHandler` hook rather than `onRequest`: Fastify parses the body between
 * the two, and its stream callbacks would drop a context entered earlier.
 * `preHandler` runs after parsing and calls the route handler synchronously
 * from `done`, so the context holds for the whole handler.
 */
export function registerRequestContext(app: NestFastifyApplication): void {
  app
    .getHttpAdapter()
    .getInstance()
    .addHook("preHandler", (request, _reply, done) => {
      storage.run(
        { ip: request.ip, userAgent: request.headers["user-agent"] },
        done,
      );
    });
}

/** The request being handled, or undefined outside one (a cron job, a test). */
export function currentRequest(): RequestContext | undefined {
  return storage.getStore();
}
