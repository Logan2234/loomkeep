import type { ArgumentsHost } from "@nestjs/common";
import { Catch, HttpException, HttpStatus } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import type { FastifyRequest } from "fastify";

// Logging only — the response NestJS would normally send (status code,
// body shape) is completely unchanged, since `catch()` always delegates to
// `super.catch()` (BaseExceptionFilter's own default handling) after
// logging. 5xx (unexpected — a real bug) logs at "error" with the full
// stack; 4xx (HttpException instances like NotFoundException/
// ConflictException — the app rejecting a request on purpose) logs at
// "warn" instead, so real bugs aren't drowned out in an "error" search.
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  constructor(private readonly logger: Logger) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const context = { method: request?.method, url: request?.url };

    if (status >= 500) {
      this.logger.error({ err: exception, ...context }, "Unhandled exception");
    } else if (status >= 400) {
      this.logger.warn({ err: exception, ...context }, "Request rejected");
    }

    super.catch(exception, host);
  }
}
