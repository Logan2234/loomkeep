import { loggerOptions } from "./logger.config";

describe("loggerOptions", () => {
  it("redacts every header that carries a credential", () => {
    const { paths } = (
      loggerOptions.pinoHttp as { redact: { paths: string[] } }
    ).redact;

    expect(paths).toEqual(
      expect.arrayContaining([
        "req.headers.authorization",
        "req.headers.cookie",
        // The Android widgets authenticate with it, and it can write.
        'req.headers["x-widget-token"]',
      ]),
    );
  });
});
