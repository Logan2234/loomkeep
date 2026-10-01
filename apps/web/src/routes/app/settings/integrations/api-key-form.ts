import type { ApiKeyDto } from "@loomkeep/shared";

export type ExpirationChoice = "30" | "90" | "365" | "custom" | "never";
export const DEFAULT_EXPIRATION: ExpirationChoice = "90";

/** Below this, a key's expiration is flagged in the list. */
const EXPIRING_SOON_DAYS = 7;
const DAY_MS = 86_400_000;

/**
 * The `expiresAt` to send for a choice. A custom date expires at the end of
 * that day, local time, so picking "tomorrow" never yields a key that dies
 * in a few hours.
 */
export function expiresAtFor(
  choice: ExpirationChoice,
  customDate: string,
  now = new Date(),
): string | null {
  if (choice === "never") return null;

  if (choice === "custom") {
    const [year, month, day] = customDate.split("-").map(Number);
    return new Date(year, month - 1, day, 23, 59, 59).toISOString();
  }

  return new Date(now.getTime() + Number(choice) * DAY_MS).toISOString();
}

/** The earliest date the custom picker offers: tomorrow, as `YYYY-MM-DD`. */
export function minCustomDate(now = new Date()): string {
  const tomorrow = new Date(now.getTime() + DAY_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
}

export type ExpiryState = "never" | "active" | "soon" | "expired";

export function expiryState(
  key: Pick<ApiKeyDto, "expiresAt">,
  now = new Date(),
): ExpiryState {
  if (!key.expiresAt) return "never";
  const left = new Date(key.expiresAt).getTime() - now.getTime();
  if (left <= 0) return "expired";
  return left < EXPIRING_SOON_DAYS * DAY_MS ? "soon" : "active";
}
