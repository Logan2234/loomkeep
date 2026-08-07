import type { ArgumentsHost } from "@nestjs/common";
import { NotFoundException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import * as Sentry from "@sentry/node";
import type { Logger } from "nestjs-pino";
import { AllExceptionsFilter } from "./all-exceptions.filter";

jest.mock("@sentry/node", () => ({ captureException: jest.fn() }));

function makeHost(): ArgumentsHost {
  const request = { method: "GET", url: "/api/whatever" };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ArgumentsHost;
}

describe("AllExceptionsFilter", () => {
  const logger = { error: jest.fn(), warn: jest.fn() } as unknown as Logger;
  // BaseExceptionFilter.catch() needs a real Nest HTTP adapter to send a
  // response — irrelevant to what this filter adds on top, so it's stubbed
  // out and asserted on separately (still delegated to, response untouched).
  const superCatch = jest
    .spyOn(BaseExceptionFilter.prototype, "catch")
    .mockImplementation(() => undefined);

  afterEach(() => jest.clearAllMocks());

  it("reports 5xx (unexpected) exceptions to Sentry/GlitchTip", () => {
    const filter = new AllExceptionsFilter(logger);
    const error = new Error("boom");
    const host = makeHost();

    filter.catch(error, host);

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(logger.error).toHaveBeenCalled();
    expect(superCatch).toHaveBeenCalledWith(error, host);
  });

  it("does not report 4xx (expected) exceptions to Sentry/GlitchTip", () => {
    const filter = new AllExceptionsFilter(logger);
    const error = new NotFoundException();

    filter.catch(error, makeHost());

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(superCatch).toHaveBeenCalled();
  });
});
