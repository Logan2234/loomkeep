import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { AppException } from "../common/app.exception";

/** A moderation suspension in force: `suspendedUntil` still in the future. */
export function isSuspended(
  user: { suspendedUntil: Date | null },
  now = new Date(),
): boolean {
  return user.suspendedUntil !== null && user.suspendedUntil > now;
}

/** Users with no suspension in force, for jobs that email or push them. */
export function notSuspended(now = new Date()): Prisma.UserWhereInput {
  return {
    OR: [{ suspendedUntil: null }, { suspendedUntil: { lte: now } }],
  };
}

/**
 * Refuses a session to a suspended account. Only called once the
 * credentials are proven, so the end date is never shown to a stranger.
 */
export function assertNotSuspended(user: {
  suspendedUntil: Date | null;
}): void {
  if (isSuspended(user)) {
    throw new AppException(
      HttpStatus.FORBIDDEN,
      ErrorCode.AuthAccountSuspended,
      {
        until: user.suspendedUntil!.toISOString(),
      },
    );
  }
}
