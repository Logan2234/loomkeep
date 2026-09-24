import type { ConfigService } from "@nestjs/config";
import { generateKeyPairSync } from "node:crypto";
import { vi } from "vitest";
import type { EntitlementService } from "../../entitlements/entitlement.service";
import type { FeatureFlagsService } from "../../feature-flags/feature-flags.service";
import {
  isLicenseCurrent,
  signLicenseKey,
  verifyLicenseKey,
} from "./license-key";
import { LicenseService } from "./license.service";

// The service checks keys against the embedded maintainer key; tests sign
// their own, so they swap in the public half of a throwaway pair.
const { PUBLIC_PEM, PRIVATE_PEM } = vi.hoisted(() => {
  // Hoisted above the imports, so it can't use the static one.
  const crypto = process.getBuiltinModule("node:crypto");
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  return {
    PUBLIC_PEM: publicKey.export({ type: "spki", format: "pem" }).toString(),
    PRIVATE_PEM: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
});

vi.mock("./license-key", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./license-key")>()),
  LICENSE_PUBLIC_KEY: PUBLIC_PEM,
}));

const payload = { licensee: "Alice", expiresAt: "2027-09-24T00:00:00.000Z" };
const duringTerm = new Date("2027-01-01T00:00:00Z");

describe("verifyLicenseKey", () => {
  it("reads back a key signed by the matching private key", () => {
    const key = signLicenseKey(payload, PRIVATE_PEM);
    expect(verifyLicenseKey(key, PUBLIC_PEM)).toEqual(payload);
  });

  it("rejects a key whose payload was edited after signing", () => {
    const [, signature] = signLicenseKey(payload, PRIVATE_PEM).split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...payload, instanceWide: true }),
    ).toString("base64url");

    expect(verifyLicenseKey(`${forged}.${signature}`, PUBLIC_PEM)).toBeNull();
  });

  it("rejects a key signed by anyone else", () => {
    const other = generateKeyPairSync("ed25519").privateKey.export({
      type: "pkcs8",
      format: "pem",
    });
    const key = signLicenseKey(payload, other.toString());

    expect(verifyLicenseKey(key, PUBLIC_PEM)).toBeNull();
  });

  it.each(["", "garbage", "a.b.c", "not-base64.@@@"])(
    "rejects malformed input %j without throwing",
    (key) => {
      expect(verifyLicenseKey(key, PUBLIC_PEM)).toBeNull();
    },
  );
});

describe("isLicenseCurrent", () => {
  it("keeps working for two weeks past expiry, then stops", () => {
    expect(isLicenseCurrent(payload, new Date("2027-10-07T23:59:59Z"))).toBe(
      true,
    );
    expect(isLicenseCurrent(payload, new Date("2027-10-08T00:00:00Z"))).toBe(
      false,
    );
  });
});

function makeService(key: string | undefined, premiumLaunched: boolean) {
  const config = {
    get: vi.fn().mockReturnValue(key),
  } as unknown as ConfigService;
  const flags = {
    isEnabled: vi.fn().mockReturnValue(premiumLaunched),
  } as unknown as FeatureFlagsService;
  const entitlements = {
    setInstancePremiumSource: vi.fn(),
  } as unknown as EntitlementService;

  return {
    service: new LicenseService(config, flags, entitlements),
    entitlements,
  };
}

describe("LicenseService.isActive", () => {
  it("stays on without a key until the premium offer launches", () => {
    expect(makeService(undefined, false).service.isActive()).toBe(true);
  });

  it("needs a valid key once the premium offer is live", () => {
    const key = signLicenseKey(payload, PRIVATE_PEM);

    expect(makeService(undefined, true).service.isActive()).toBe(false);
    expect(makeService("not-a-key", true).service.isActive()).toBe(false);
    expect(makeService(key, true).service.isActive(duringTerm)).toBe(true);
  });
});

describe("LicenseService.grantsInstancePremium", () => {
  const selfHostKey = signLicenseKey(
    { ...payload, instanceWide: true },
    PRIVATE_PEM,
  );

  it("makes every account premium with a self-host key", () => {
    const { service } = makeService(selfHostKey, true);
    expect(service.grantsInstancePremium(duringTerm)).toBe(true);
  });

  it("leaves premium per account with the hosted instance's key", () => {
    const { service } = makeService(signLicenseKey(payload, PRIVATE_PEM), true);
    expect(service.grantsInstancePremium(duringTerm)).toBe(false);
  });

  it("stops once the self-host key has expired", () => {
    const { service } = makeService(selfHostKey, true);
    expect(
      service.grantsInstancePremium(new Date("2028-01-01T00:00:00Z")),
    ).toBe(false);
  });

  it("hands its check to the core entitlements at startup", () => {
    const { entitlements } = makeService(undefined, true);
    expect(entitlements.setInstancePremiumSource).toHaveBeenCalledOnce();
  });
});
