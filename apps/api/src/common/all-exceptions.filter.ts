import type { ApiErrorBody } from "@loomkeep/shared";
import { ErrorCode } from "@loomkeep/shared";
import type { ArgumentsHost } from "@nestjs/common";
import { Catch, HttpException, HttpStatus } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
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

    const body = this.buildBody(exception, status, request?.id);
    this.httpAdapterHost.httpAdapter.reply(response, body, status);
  }

  private resolveStatus(exception: unknown): number {
    return exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private buildBody(
    exception: unknown,
    status: number,
    requestId: string | undefined,
  ): ApiErrorBody {
    if (status >= 500) {
      return {
        statusCode: status,
        code: ErrorCode.InternalError,
        requestId,
        message: GENERIC_SERVER_ERROR_MESSAGE,
      };
    }

    if (exception instanceof ValidationException) {
      return {
        statusCode: status,
        code: exception.code,
        details: exception.details,
        requestId,
        message: exception.message,
      };
    }

    if (exception instanceof AppException) {
      return {
        statusCode: status,
        code: exception.code,
        params: exception.params,
        requestId,
        message: exception.message,
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
