import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

/**
 * The maintainer's Ed25519 public key. License keys are signed with the
 * matching private key, which never leaves the maintainer's machine; swapping
 * this constant to accept self-made keys is a breach of LICENSE-EE.
 */
export const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAxO2k3Sxe9yz5hrW6XPfv3GvFFwpEfWEWyAxY8lu0maU=
-----END PUBLIC KEY-----`;

/** How long a key keeps working past `expiresAt`, so a late renewal breaks nothing. */
const LICENSE_GRACE_DAYS = 14;

const DAY_MS = 86_400_000;

export interface LicensePayload {
  /** Who the key was issued to, for the maintainer's records and the logs. */
  licensee: string;
  /** ISO datetime. Keys are annual: renewing means issuing a new one. */
  expiresAt: string;
  /**
   * A self-host key: every account of the instance is premium. Absent on the
   * hosted instance's key, where premium stays per account (UserEntitlement).
   */
  instanceWide?: boolean;
}

/**
 * A key is `<payload>.<signature>`, both base64url: the JSON payload and its
 * Ed25519 signature. Checked offline — an instance never calls home.
 */
export function signLicenseKey(
  payload: LicensePayload,
  privateKeyPem: string,
): string {
  const data = Buffer.from(JSON.stringify(payload), "utf8");
  const signature = sign(null, data, createPrivateKey(privateKeyPem));
  return `${data.toString("base64url")}.${signature.toString("base64url")}`;
}

/** The payload of a key signed by `publicKeyPem`, or null for anything else. */
export function verifyLicenseKey(
  key: string,
  publicKeyPem: string,
): LicensePayload | null {
  const parts = key.trim().split(".");
  if (parts.length !== 2) return null;

  const [data, signature] = parts.map((part) => Buffer.from(part, "base64url"));

  try {
    if (!verify(null, data, createPublicKey(publicKeyPem), signature)) {
      return null;
    }

    const payload = JSON.parse(
      data.toString("utf8"),
    ) as Partial<LicensePayload>;

    if (
      typeof payload.licensee !== "string" ||
      typeof payload.expiresAt !== "string" ||
      Number.isNaN(Date.parse(payload.expiresAt))
    ) {
      return null;
    }

    return {
      licensee: payload.licensee,
      expiresAt: payload.expiresAt,
      ...(payload.instanceWide === true ? { instanceWide: true } : {}),
    };
  } catch {
    return null;
  }
}

/** Whether `now` is before the key's expiry plus its grace period. */
export function isLicenseCurrent(payload: LicensePayload, now: Date): boolean {
  const expiresAt = Date.parse(payload.expiresAt);
  return now.getTime() < expiresAt + LICENSE_GRACE_DAYS * DAY_MS;
}
