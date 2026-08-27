import { ErrorCode } from "@loomkeep/shared";
import type { ArgumentsHost } from "@nestjs/common";
import { HttpStatus, NotFoundException } from "@nestjs/common";
import type { HttpAdapterHost } from "@nestjs/core";
import * as Sentry from "@sentry/node";
import type { Logger } from "nestjs-pino";
import { AllExceptionsFilter } from "./all-exceptions.filter";
import { AppException } from "./app.exception";
import { ValidationException } from "./validation.exception";

jest.mock("@sentry/node", () => ({ captureException: jest.fn() }));

function makeHost(requestId = "req-1") {
  const request = { method: "GET", url: "/api/whatever", id: requestId };
  const response = {};
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe("AllExceptionsFilter", () => {
  const logger = { error: jest.fn(), warn: jest.fn() } as unknown as Logger;
  const reply = jest.fn();
  const httpAdapterHost = {
    httpAdapter: { reply },
  } as unknown as HttpAdapterHost;
  const filter = new AllExceptionsFilter(logger, httpAdapterHost);

  afterEach(() => jest.clearAllMocks());

  it("reports 5xx (unexpected) exceptions to Sentry/GlitchTip and scrubs the message", () => {
    const error = new Error("Prisma exploded with connection string leaked");
    const { host, response } = makeHost("req-500");

    filter.catch(error, host);

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(logger.error).toHaveBeenCalled();
    const [sentResponse, body, status] = reply.mock.calls[0];
    expect(sentResponse).toBe(response);
    expect(status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body).toEqual({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.InternalError,
      requestId: "req-500",
      message: "Internal server error",
    });
    expect(JSON.stringify(body)).not.toContain("Prisma");
  });

  it("does not report 4xx (expected) exceptions to Sentry/GlitchTip", () => {
    const error = new NotFoundException("Widget not found");
    const { host } = makeHost();

    filter.catch(error, host);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(reply.mock.calls[0][2]).toBe(HttpStatus.NOT_FOUND);
  });

  it("emits code:null for a bare HttpException, so the web app falls back on the status", () => {
    const error = new NotFoundException("Widget not found");
    const { host } = makeHost("req-2");

    filter.catch(error, host);

    expect(reply.mock.calls[0][1]).toEqual({
      statusCode: HttpStatus.NOT_FOUND,
      code: null,
      requestId: "req-2",
      message: "Widget not found",
    });
  });

  it("emits the code and params for an AppException", () => {
    const error = new AppException(
      HttpStatus.CONFLICT,
      ErrorCode.AuthEmailAlreadyExists,
      { email: "a@b.com" },
      "dev-facing detail",
    );
    const { host } = makeHost("req-3");

    filter.catch(error, host);

    expect(reply.mock.calls[0][1]).toEqual({
      statusCode: HttpStatus.CONFLICT,
      code: ErrorCode.AuthEmailAlreadyExists,
      params: { email: "a@b.com" },
      requestId: "req-3",
      message: "dev-facing detail",
    });
  });

  it("emits validation.failed with structured details for a ValidationException", () => {
    const error = new ValidationException([
      {
        property: "email",
        constraints: { isEmail: "email must be an email" },
      },
    ]);
    const { host } = makeHost("req-4");

    filter.catch(error, host);

    expect(reply.mock.calls[0][1]).toEqual({
      statusCode: HttpStatus.BAD_REQUEST,
      code: ErrorCode.ValidationFailed,
      details: [{ field: "email", constraint: "isEmail" }],
      requestId: "req-4",
      message: "email: isEmail",
    });
  });

  it("puts the request id in the body", () => {
    const { host } = makeHost("req-abc-123");

    filter.catch(new NotFoundException(), host);

    expect(reply.mock.calls[0][1]).toEqual(
      expect.objectContaining({ requestId: "req-abc-123" }),
    );
  });
});
