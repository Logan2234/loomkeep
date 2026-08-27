import { ErrorCode, errorCodeToMessageKey } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en/errors.json";
import fr from "../../../messages/fr/errors.json";

// Guardrail for the "API error codes" rework: every code declared in
// packages/shared/src/error-codes.ts must have a translated message in both
// locales, and every apierr_* key in the message files must correspond to a
// real code — otherwise a code silently falls back to the generic
// per-status message (see resolveApiError in ./errors.ts) or a stale key
// lingers after a code is renamed/removed.
describe("error code translations", () => {
  const codes = Object.values(ErrorCode);
  const expectedKeys = new Set(codes.map(errorCodeToMessageKey));

  it("has a fr and en message for every ErrorCode", () => {
    for (const code of codes) {
      const key = errorCodeToMessageKey(code);
      expect(
        fr,
        `fr.json missing "${key}" for ErrorCode "${code}"`,
      ).toHaveProperty(key);
      expect(
        en,
        `en.json missing "${key}" for ErrorCode "${code}"`,
      ).toHaveProperty(key);
    }
  });

  // apierr_status_* is a small, fixed set of HTTP-status fallbacks (see
  // STATUS_MESSAGES/statusFallback in ./errors.ts, including the
  // apierr_status_429_retry variant) — not derived from ErrorCode, so it's
  // deliberately exempt from the orphan check below.
  const isStatusFallbackKey = (key: string) =>
    /^apierr_status_\d+(_\w+)?$/.test(key);

  it("has no orphan apierr_* key left over from a removed/renamed code", () => {
    for (const key of Object.keys(fr)) {
      if (!key.startsWith("apierr_") || isStatusFallbackKey(key)) continue;
      expect(expectedKeys, `fr.json has orphan key "${key}"`).toContain(key);
    }

    for (const key of Object.keys(en)) {
      if (!key.startsWith("apierr_") || isStatusFallbackKey(key)) continue;
      expect(expectedKeys, `en.json has orphan key "${key}"`).toContain(key);
    }
  });
});
