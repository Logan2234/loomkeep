import { m } from "$lib/paraglide/messages.js";
import { ErrorCode } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en/errors.json";
import fr from "../../../messages/fr/errors.json";
import { ApiError } from "./core";
import {
  bannerMessage,
  fieldError,
  VALERR_MESSAGE_KEYS,
} from "./validation-messages";

// Guardrail mirroring error-codes-i18n.spec.ts, but for per-field validation
// messages: every key CONSTRAINT_MESSAGES can produce (VALERR_MESSAGE_KEYS,
// see ./validation-messages.ts) must have a translated message in both
// locales, and every valerr_* key in the message files must be one of them —
// otherwise a constraint silently falls back to the generic per-field
// message (fieldError()'s valerr_generic) or a stale key lingers after a
// constraint stops being used. Coverage against the DTOs themselves
// (VALIDATION_CONSTRAINT_NAMES, packages/shared) is enforced separately by
// CONSTRAINT_MESSAGES' `satisfies Record<ValidationConstraintName, ...>` at
// compile time, and kept in sync with the actual DTOs by apps/api's
// validation-constraint-names.spec.ts.
describe("validation constraint message translations", () => {
  it("has a fr and en message for every valerr_* key this module can produce", () => {
    for (const key of VALERR_MESSAGE_KEYS) {
      expect(fr, `fr.json missing "${key}"`).toHaveProperty(key);
      expect(en, `en.json missing "${key}"`).toHaveProperty(key);
    }
  });

  it("has no orphan valerr_* key left over from a removed constraint", () => {
    const expected = new Set<string>(VALERR_MESSAGE_KEYS);

    for (const key of Object.keys(fr)) {
      if (!key.startsWith("valerr_")) continue;
      expect(expected, `fr.json has orphan key "${key}"`).toContain(key);
    }

    for (const key of Object.keys(en)) {
      if (!key.startsWith("valerr_")) continue;
      expect(expected, `en.json has orphan key "${key}"`).toContain(key);
    }
  });
});

function validationError(
  details: {
    field: string;
    constraint: string;
    params?: (string | number | boolean)[];
  }[],
): ApiError {
  return new ApiError(
    400,
    "dev text",
    ErrorCode.ValidationFailed,
    undefined,
    details,
  );
}

describe("fieldError", () => {
  it("translates a field's constraint with its params interpolated", () => {
    const err = validationError([
      { field: "password", constraint: "minLength", params: [8] },
    ]);

    expect(fieldError(err, "password")).toBe(m.valerr_min_length({ min: 8 }));
  });

  it("returns undefined for a field with no detail", () => {
    const err = validationError([{ field: "email", constraint: "isEmail" }]);

    expect(fieldError(err, "password")).toBeUndefined();
  });

  it("falls back to the generic per-field message for an unrecognized constraint", () => {
    const err = validationError([
      { field: "email", constraint: "someFutureConstraint" },
    ]);

    expect(fieldError(err, "email")).toBe(m.valerr_generic());
  });

  it("returns undefined for a non-validation error", () => {
    const err = new ApiError(404, "dev text", ErrorCode.LibraryEpisodeNotAired);

    expect(fieldError(err, "email")).toBeUndefined();
  });
});

describe("bannerMessage", () => {
  it("suppresses the banner when every detail is covered by a tracked field", () => {
    const err = validationError([{ field: "email", constraint: "isEmail" }]);

    expect(bannerMessage(err, ["email"])).toBeNull();
  });

  it("still shows the banner when a detail isn't covered by any tracked field", () => {
    const err = validationError([
      { field: "email", constraint: "isEmail" },
      { field: "password", constraint: "minLength", params: [8] },
    ]);

    expect(bannerMessage(err, ["email"])).toBe(m.apierr_validation_failed());
  });

  it("shows the banner for a non-validation error regardless of coveredFields", () => {
    const err = new ApiError(
      0,
      "Network request failed",
      ErrorCode.NetworkOffline,
    );

    expect(bannerMessage(err, ["email"])).toBe(m.apierr_network_offline());
  });

  it("shows the banner by default when no fields are covered", () => {
    const err = validationError([{ field: "email", constraint: "isEmail" }]);

    expect(bannerMessage(err)).toBe(m.apierr_validation_failed());
  });
});
