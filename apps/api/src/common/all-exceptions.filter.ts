import type { ApiErrorBody } from "@loomkeep/shared";
import { ErrorCode } from "@loomkeep/shared";
import type { ArgumentsHost } from "@nestjs/common";
import { Catch, HttpException, HttpStatus } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Prisma } from "@prisma/client";
import * as Sentry from "@sentry/node";
import type { FastifyRequest } from "fastify";
import { Logger } from "nestjs-pino";
import { AppException } from "./app.exception";
import { ValidationException } from "./validation.exception";

const GENERIC_SERVER_ERROR_MESSAGE = "Internal server error";

// Builds the response body (see ApiErrorBody) as well as logging. 5xx
// (unexpected — a real bug) logs at "error" with the full stack, and is
// also reported to GlitchTip (see instrument.ts — a no-op if Sentry.init()
// was never called, e.g. no DSN configured or non-production); 4xx
// (the app rejecting a request on purpose) only logs at "warn" instead, so
// neither the log search nor GlitchTip's issue list gets drowned out by
// expected rejections. Unlike Nest's default handling, the client-facing
// body never carries anything but a constant message for 5xx — the real
// detail (Prisma error, provider stack...) stays in the logs, keyed by the
// same requestId.
//
// Sends the response via HttpAdapterHost.httpAdapter.reply() rather than
// calling reply.code()/.send() directly: host.switchToHttp().getResponse()
// returns the raw Node ServerResponse (reply.raw), not the Fastify Reply
// wrapper, for a globally-registered filter — httpAdapter.reply() is the
// platform-agnostic way BaseExceptionFilter itself uses under the hood.
/**
 * Prisma errors that mean another request got there first rather than a bug:
 * a unique constraint already satisfied (P2002, e.g. two editors adding the
 * same work to a list) or the targeted row already gone (P2025). Services
 * that can do better (adopt the winner's row) still catch them themselves;
 * this is the floor, so the rest answer 409/404 instead of a 500 that also
 * lands in GlitchTip.
 */
const PRISMA_RACE_STATUS: Record<string, number> = {
  P2002: HttpStatus.CONFLICT,
  P2025: HttpStatus.NOT_FOUND,
};
const PRISMA_RACE_CODE: Record<string, ErrorCode> = {
  P2002: ErrorCode.InternalConflict,
  P2025: ErrorCode.InternalRecordGone,
};

function prismaErrorCode(exception: unknown): string | null {
  return exception instanceof Prisma.PrismaClientKnownRequestError
    ? exception.code
    : null;
}

@Catch()
export class AllExceptionsFilter {
  constructor(
    private readonly logger: Logger,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const status = this.resolveStatus(exception);
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const response = host.switchToHttp().getResponse();
    const context = { method: request?.method, url: request?.url };

    if (status >= 500) {
      this.logger.error({ err: exception, ...context }, "Unhandled exception");
      Sentry.captureException(exception);
    } else if (status >= 400) {
      this.logger.warn({ err: exception, ...context }, "Request rejected");
    }

    // request.id is typed as string, but pino-http's own default id
    // generator (used when nestjs-pino's LoggerModule wires it up) returns a
    // raw number — coerce explicitly rather than trust the type.
    const requestId =
      request?.id !== undefined ? String(request.id) : undefined;
    const body = this.buildBody(exception, status, requestId);
    this.httpAdapterHost.httpAdapter.reply(response, body, status);
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    return (
      PRISMA_RACE_STATUS[prismaErrorCode(exception) ?? ""] ??
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  private buildBody(
    exception: unknown,
    status: number,
    requestId: string | undefined,
  ): ApiErrorBody {
    // A curated AppException/ValidationException code is always safe to
    // send even for a 5xx (it's a fixed string the thrower deliberately
    // picked, e.g. catalog.provider_unavailable) — only the free-text
    // `message` risks leaking something real (a caught error's own
    // message, a Prisma detail) and gets scrubbed to the generic sentence
    // below. Only a *code-less* 5xx (an unwrapped crash, not deliberately
    // thrown as an AppException) falls back to ErrorCode.InternalError.
    if (exception instanceof ValidationException) {
      return {
        statusCode: status,
        code: exception.code,
        details: exception.details,
        requestId,
        message:
          status >= 500 ? GENERIC_SERVER_ERROR_MESSAGE : exception.message,
      };
    }

    if (exception instanceof AppException) {
      return {
        statusCode: status,
        code: exception.code,
        params: exception.params,
        requestId,
        message:
          status >= 500 ? GENERIC_SERVER_ERROR_MESSAGE : exception.message,
      };
    }

    // A write that lost a race (see PRISMA_RACE_STATUS): an expected outcome
    // of concurrency, not a bug, so a 4xx with its own code. The Prisma
    // message names tables and columns and never goes out.
    const raceCode = PRISMA_RACE_CODE[prismaErrorCode(exception) ?? ""];

    if (raceCode && status < 500) {
      return {
        statusCode: status,
        code: raceCode,
        requestId,
        message: status === HttpStatus.CONFLICT ? "Conflict" : "Not found",
      };
    }

    if (status >= 500) {
      return {
        statusCode: status,
        code: ErrorCode.InternalError,
        requestId,
        message: GENERIC_SERVER_ERROR_MESSAGE,
      };
    }

    if (exception instanceof HttpException) {
      return {
        statusCode: status,
        code: null,
        requestId,
        message: this.extractMessage(exception),
      };
    }

    // Not an HttpException at all, but status is < 500 — shouldn't really
    // happen (resolveStatus only returns < 500 for HttpException instances),
    // kept only for exhaustiveness.
    return {
      statusCode: status,
      code: null,
      requestId,
      message: GENERIC_SERVER_ERROR_MESSAGE,
    };
  }

  private extractMessage(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === "string") return response;

    if (
      typeof response === "object" &&
      response !== null &&
      "message" in response
    ) {
      const message = (response as { message: unknown }).message;
      return Array.isArray(message) ? message.join(", ") : String(message);
    }

    return exception.message;
  }
}
