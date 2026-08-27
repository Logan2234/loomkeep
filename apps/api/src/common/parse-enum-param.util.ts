import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import { AppException } from "./app.exception";

/**
 * Parse a case-insensitive route/query param into one of `allowed`'s enum
 * values, throwing a 400 (`Unknown <label> '<value>'`) when it matches none.
 * `label` names the enum in the error, e.g. "catalog source".
 */
export function parseEnumParam<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): T {
  const upper = value.toUpperCase();

  if (!allowed.includes(upper as T)) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.InvalidParam,
      { label, value },
      `Unknown ${label} '${value}'`,
    );
  }

  return upper as T;
}
