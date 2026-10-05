import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import { AppException } from "./app.exception";

export function sessionDate(value: string): Date {
  const date = new Date(value);

  if (date.getTime() > Date.now()) {
    throw new AppException(
      HttpStatus.BAD_REQUEST,
      ErrorCode.LibrarySessionDateFuture,
    );
  }

  return date;
}

export function normalizeSessionNotes(
  notes: string | null | undefined,
): string | null {
  const trimmed = notes?.trim();
  return trimmed ? trimmed : null;
}
