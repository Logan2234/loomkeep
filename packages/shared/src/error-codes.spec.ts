import { describe, expect, it } from "vitest";
import { ErrorCode, errorCodeToMessageKey } from "./error-codes";

describe("errorCodeToMessageKey", () => {
  it("turns a domain.reason code into its apierr_ message key", () => {
    expect(errorCodeToMessageKey(ErrorCode.LibraryEpisodeNotAired)).toBe(
      "apierr_library_episode_not_aired",
    );
  });

  it("produces one distinct, well-formed key per error code", () => {
    // apps/web derives its i18n keys mechanically from these, so a collision
    // or a stray character would silently point two errors at one message.
    const keys = Object.values(ErrorCode).map(errorCodeToMessageKey);

    expect(new Set(keys).size).toBe(keys.length);

    for (const key of keys) {
      expect(key).toMatch(/^apierr_[a-z0-9_]+$/u);
    }
  });
});
