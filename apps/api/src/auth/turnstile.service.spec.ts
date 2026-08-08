import type { ConfigService } from "@nestjs/config";
import { TurnstileService } from "./turnstile.service";

function makeService(secret: string | undefined) {
  const config = {
    get: jest.fn(() => secret),
  } as unknown as ConfigService;

  return new TurnstileService(config);
}

describe("TurnstileService.verify", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("is a no-op (always passes) when TURNSTILE_SECRET_KEY is unset", async () => {
    const service = makeService(undefined);

    await expect(service.verify("some-token")).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing token when Turnstile is enabled", async () => {
    const service = makeService("secret");

    await expect(service.verify(undefined)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls Cloudflare's siteverify and returns its success flag", async () => {
    const service = makeService("secret");
    fetchMock.mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });

    await expect(service.verify("good-token", "1.2.3.4")).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    const body = init.body as URLSearchParams;
    expect(body.get("secret")).toBe("secret");
    expect(body.get("response")).toBe("good-token");
    expect(body.get("remoteip")).toBe("1.2.3.4");
  });

  it("fails closed when the verification request itself throws", async () => {
    const service = makeService("secret");
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(service.verify("token")).resolves.toBe(false);
  });
});
