import { m } from "$lib/paraglide/messages.js";
import { ErrorCode, type ValidationConstraintName } from "@loomkeep/shared";
import { ApiError } from "./core";
import { resolveApiError } from "./errors";

type ConstraintParam = string | number | boolean;

function asNumber(param: ConstraintParam | undefined) {
  return typeof param === "number" ? param : 0;
}

/**
 * One translated message per class-validator constraint name — interpolated
 * positionally the same way class-validator's own `$constraint1`/
 * `$constraint2` templates work (see ApiErrorBody.details[].params' doc
 * comment in packages/shared/src/error-codes.ts): `params[0]` is always the
 * decorator's first argument, `params[1]` its second, etc. `satisfies
 * Record<ValidationConstraintName, ...>` makes adding a name to
 * VALIDATION_CONSTRAINT_NAMES without a matching entry here a typecheck
 * failure — validation-messages.spec.ts covers the i18n-key half of that
 * guarantee (this table existing doesn't yet prove `m.valerr_*` exists).
 */
const CONSTRAINT_MESSAGES = {
  isString: () => m.valerr_is_string(),
  isNotEmpty: () => m.valerr_is_not_empty(),
  isEmail: () => m.valerr_is_email(),
  isBoolean: () => m.valerr_is_boolean(),
  isNumber: () => m.valerr_is_number(),
  isInt: () => m.valerr_is_int(),
  isArray: () => m.valerr_is_array(),
  isObject: () => m.valerr_is_object(),
  // isIso8601 is IsDateString's underlying validator, reachable directly via
  // @IsISO8601() too — same wording either way.
  isDateString: () => m.valerr_is_date_string(),
  isIso8601: () => m.valerr_is_date_string(),
  isIn: () => m.valerr_is_in(),
  equals: () => m.valerr_equals(),
  minLength: (params) => m.valerr_min_length({ min: asNumber(params?.[0]) }),
  maxLength: (params) => m.valerr_max_length({ max: asNumber(params?.[0]) }),
  // @Length(min, max) — every current usage is an exact-length code
  // (@Length(6, 6)), but stays generic for a future min !== max usage.
  isLength: (params) => {
    const min = asNumber(params?.[0]);
    const max = asNumber(params?.[1]);
    return min === max
      ? m.valerr_length_exact({ count: min })
      : m.valerr_length_range({ min, max });
  },
  min: (params) => m.valerr_min({ min: asNumber(params?.[0]) }),
  max: (params) => m.valerr_max({ max: asNumber(params?.[0]) }),
  // A regex is never shown to a user — see the sanitization in
  // apps/api/src/common/validation-params.util.ts, which drops it before it
  // ever reaches here.
  matches: () => m.valerr_matches(),
  arrayMinSize: (params) =>
    m.valerr_array_min_size({ min: asNumber(params?.[0]) }),
  arrayMaxSize: (params) =>
    m.valerr_array_max_size({ max: asNumber(params?.[0]) }),
  arrayNotEmpty: () => m.valerr_array_not_empty(),
  arrayUnique: () => m.valerr_array_unique(),
} satisfies Record<
  ValidationConstraintName,
  (params?: ConstraintParam[]) => string
>;

/**
 * Every `valerr_*` Paraglide key CONSTRAINT_MESSAGES can produce. Not a
 * mechanical 1:1 mapping from VALIDATION_CONSTRAINT_NAMES — isIso8601
 * aliases isDateString's key, and isLength branches into two — so this list
 * is the actual source of truth for validation-messages.spec.ts's i18n
 * coverage/orphan checks, not something derived from the constraint names.
 */
export const VALERR_MESSAGE_KEYS = [
  "valerr_is_string",
  "valerr_is_not_empty",
  "valerr_is_email",
  "valerr_is_boolean",
  "valerr_is_number",
  "valerr_is_int",
  "valerr_is_array",
  "valerr_is_object",
  "valerr_is_date_string",
  "valerr_is_in",
  "valerr_equals",
  "valerr_min_length",
  "valerr_max_length",
  "valerr_length_exact",
  "valerr_length_range",
  "valerr_min",
  "valerr_max",
  "valerr_matches",
  "valerr_array_min_size",
  "valerr_array_max_size",
  "valerr_array_not_empty",
  "valerr_array_unique",
  // Not produced by CONSTRAINT_MESSAGES itself — the fallback for a
  // constraint name it doesn't recognize (see fieldError() below).
  "valerr_generic",
] as const;

/**
 * The translated message for one field's validation failure, or undefined
 * when `err` isn't a validation.failed ApiError or carries no detail for
 * that field. `field` must match the DTO property name exactly (nested
 * paths like "keys.p256dh" or indexed ones like "items.0.name" from
 * `{ each: true }` never match a single input's name and simply never
 * resolve here — bannerMessage() below is what covers them, so nothing is
 * ever silently swallowed.
 *
 * A constraint name absent from CONSTRAINT_MESSAGES (a decorator added to a
 * DTO without updating VALIDATION_CONSTRAINT_NAMES — normally caught by
 * validation-constraint-names.spec.ts on the API side before it ships) falls
 * back to a generic per-field message rather than an empty string.
 */
export function fieldError(err: unknown, field: string) {
  if (!(err instanceof ApiError) || err.code !== ErrorCode.ValidationFailed) {
    return undefined;
  }

  const detail = err.details?.find((d) => d.field === field);
  if (!detail) return undefined;

  const entry =
    CONSTRAINT_MESSAGES[detail.constraint as keyof typeof CONSTRAINT_MESSAGES];

  return entry ? entry(detail.params) : m.valerr_generic();
}

/**
 * The generic banner text for `err`, or null when every validation.failed
 * detail is already shown under one of `coveredFields`'s inputs via
 * fieldError() — avoids showing the same error twice on a small form (one
 * field, one message) while still catching everything a per-field slot
 * can't: a network failure, a 429, a 5xx, an auth rejection, or a
 * validation.failed detail on a field outside `coveredFields` (a nested
 * path, an untracked input, a query-only DTO). `coveredFields` defaults to
 * empty, which always shows the banner — the original, always-on behavior,
 * for a form that doesn't render any per-field message at all.
 */
export function bannerMessage(err: unknown, coveredFields: string[] = []) {
  const allCovered =
    err instanceof ApiError &&
    err.code === ErrorCode.ValidationFailed &&
    !!err.details?.length &&
    err.details.every((d) => coveredFields.includes(d.field));

  return allCovered ? null : resolveApiError(err);
}
