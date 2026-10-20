import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import { AppException } from "./app.exception";

/**
 * Parses an enum parameter case-insensitively by default. Options preserve
 * route-specific case matching, error codes, messages and interpolation data.
 */
export function parseEnumParam<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
  options: {
    caseSensitive?: boolean;
    errorCode?: ErrorCode;
    message?: string;
    includeDetails?: boolean;
  } = {},
): T {
  const parsed = options.caseSensitive ? value : value.toUpperCase();

  if (!allowed.includes(parsed as T)) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      options.errorCode ?? ErrorCode.InvalidParam,
      options.includeDetails === false ? undefined : { label, value },
      options.message ?? `Unknown ${label} '${value}'`,
    );
  }

  return parsed as T;
}
