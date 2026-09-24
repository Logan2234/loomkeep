import type { ConfigService } from "@nestjs/config";
import { generateKeyPairSync } from "node:crypto";
import { vi } from "vitest";
import type { FeatureFlagsService } from "../../feature-flags/feature-flags.service";
import {
  isLicenseCurrent,
  signLicenseKey,
  verifyLicenseKey,
} from "./license-key";
import { LicenseService } from "./license.service";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PUBLIC_PEM = publicKey.export({ type: "spki", format: "pem" }).toString();
const PRIVATE_PEM = privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();

const payload = { licensee: "Alice", expiresAt: "2027-09-24T00:00:00.000Z" };

describe("verifyLicenseKey", () => {
  it("reads back a key signed by the matching private key", () => {
    const key = signLicenseKey(payload, PRIVATE_PEM);
    expect(verifyLicenseKey(key, PUBLIC_PEM)).toEqual(payload);
  });

  it("rejects a key whose payload was edited after signing", () => {
    const [, signature] = signLicenseKey(payload, PRIVATE_PEM).split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...payload, expiresAt: "2099-01-01T00:00:00.000Z" }),
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

describe("LicenseService.isActive", () => {
  function makeService(key: string | undefined, premiumLaunched: boolean) {
    const config = {
      get: vi.fn().mockReturnValue(key),
    } as unknown as ConfigService;
    const flags = {
      isEnabled: vi.fn().mockReturnValue(premiumLaunched),
    } as unknown as FeatureFlagsService;
    return new LicenseService(config, flags);
  }

  it("stays on without a key until the premium offer launches", () => {
    expect(makeService(undefined, false).isActive()).toBe(true);
  });

  it("needs a valid key once the premium offer is live", () => {
    expect(makeService(undefined, true).isActive()).toBe(false);
    expect(makeService("not-a-key", true).isActive()).toBe(false);
  });
});
