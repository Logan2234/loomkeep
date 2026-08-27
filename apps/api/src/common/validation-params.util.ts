import { getMetadataStorage } from "class-validator";

const MAX_ARRAY_PARAM_LENGTH = 5;

/**
 * Reads the raw, positional constructor arguments a class-validator
 * decorator was declared with (e.g. `constraints: [8]` for `@MinLength(8)`)
 * straight from class-validator's own metadata storage — never from the
 * already-interpolated English message on the ValidationError, and without
 * touching any DTO decorator. `getMetadataStorage` is a public export
 * (class-validator's own recommended way to introspect registered
 * validators), not an internal we're reaching into.
 *
 * Matches on the validator's `name` ("minLength", "isEmail"...) — the exact
 * key used in `ValidationError.constraints` — not `.type`, which is
 * `CUSTOM_VALIDATION` for every built-in decorator once it goes through
 * `ValidateBy`/`registerDecorator`, so it can't disambiguate constraints.
 *
 * Returns undefined if `target` is missing (see the comment in main.ts) or
 * no matching metadata is found (e.g. a schema-based validation, unused
 * here).
 */
export function extractConstraintParams(
  target: object | undefined,
  property: string,
  constraintName: string,
): (string | number | boolean)[] | undefined {
  if (!target) return undefined;

  const metadatas = getMetadataStorage().getTargetValidationMetadatas(
    target.constructor as new (...args: unknown[]) => unknown,
    "",
    true,
    false,
  );

  const match = metadatas.find(
    (m) => m.propertyName === property && m.name === constraintName,
  );

  return match ? sanitizeParams(match.constraints) : undefined;
}

/**
 * A raw constraint argument must never reach the client unfiltered: a RegExp
 * (from @Matches) serializes to "{}" over JSON and is useless anyway — we
 * never show a regex to a user — and an array (from @IsIn) can carry an
 * internal enum's full value list. Primitives pass through; arrays are
 * flattened into one truncated, comma-joined string; anything else
 * (RegExp, object, function...) is dropped.
 */
function sanitizeParams(
  raw: unknown[],
): (string | number | boolean)[] | undefined {
  const sanitized = raw
    .map(sanitizeParam)
    .filter((v): v is string | number | boolean => v !== undefined);
  return sanitized.length > 0 ? sanitized : undefined;
}

function sanitizeParam(value: unknown): string | number | boolean | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const primitives = value.filter(
      (v): v is string | number | boolean =>
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean",
    );
    if (primitives.length === 0) return undefined;
    const truncated = primitives.slice(0, MAX_ARRAY_PARAM_LENGTH);
    const suffix = primitives.length > MAX_ARRAY_PARAM_LENGTH ? ", …" : "";
    return truncated.join(", ") + suffix;
  }

  return undefined;
}
