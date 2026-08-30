import { createHash } from "node:crypto";
import { vi } from "vitest";
import { HibpService } from "./hibp.service";

// Node defines global fetch lazily, which confuses vi.spyOn on restore;
// plain assignment + manual restore is more reliable.
const originalFetch = global.fetch;

function sha1(password: string): { prefix: string; suffix: string } {
  // Mirrors the HIBP range API's own SHA-1 k-anonymity lookup key, not a credential hash.
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  return { prefix: hash.slice(0, 5), suffix: hash.slice(5) };
}

function mockRangeResponse(body: string, status = 200): void {
  global.fetch = vi.fn(() =>
    Promise.resolve(new Response(body, { status })),
  ) as typeof fetch;
}

describe("HibpService", () => {
  let service: HibpService;

  beforeEach(() => {
    service = new HibpService();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns true when the suffix is present with a positive count", async () => {
    const { suffix } = sha1("password123");
    mockRangeResponse(`${suffix}:5\nAAAA0000000000000000000000000000000:0`);

    await expect(service.isPasswordPwned("password123")).resolves.toBe(true);
  });

  it("returns false when the suffix is absent", async () => {
    sha1("a-safe-password");
    mockRangeResponse("AAAA0000000000000000000000000000000:0");

    await expect(service.isPasswordPwned("a-safe-password")).resolves.toBe(
      false,
    );
  });

  it("returns false for a padding entry (count 0)", async () => {
    const { suffix } = sha1("a-safe-password");
    mockRangeResponse(`${suffix}:0`);

    await expect(service.isPasswordPwned("a-safe-password")).resolves.toBe(
      false,
    );
  });

  it("fails open (false) when the HIBP API returns an error status", async () => {
    mockRangeResponse("", 503);

    await expect(service.isPasswordPwned("anything")).resolves.toBe(false);
  });

  it("fails open (false) when the fetch rejects", async () => {
    global.fetch = vi.fn(() =>
      Promise.reject(new Error("network down")),
    ) as typeof fetch;

    await expect(service.isPasswordPwned("anything")).resolves.toBe(false);
  });
});
