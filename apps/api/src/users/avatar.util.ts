import type { UserSummaryDto } from "@loomkeep/shared";

const MAGIC_BYTES: Record<string, (buf: Buffer) => boolean> = {
  "image/png": (buf) =>
    buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  "image/jpeg": (buf) =>
    buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  "image/webp": (buf) =>
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP",
};

/**
 * Sniffs the buffer's magic bytes against the declared mime type — the
 * client-sent `Content-Type`-equivalent is otherwise just an unchecked claim.
 */
export function matchesMimeType(buffer: Buffer, mimeType: string): boolean {
  return MAGIC_BYTES[mimeType]?.(buffer) ?? false;
}

/** Fields every avatar-bearing select must include to compute `avatarUrl`. */
export interface AvatarSource {
  id: string;
  avatarUpdatedAt: Date | null;
}

/**
 * Path (relative to the API base) to a user's uploaded profile picture, or
 * null if they haven't set one — the client falls back to the identicon.
 * `?v=` cache-busts so the browser refetches after a re-upload.
 */
export function avatarUrl(user: AvatarSource): string | null {
  return user.avatarUpdatedAt
    ? `/users/${user.id}/avatar?v=${user.avatarUpdatedAt.getTime()}`
    : null;
}

/**
 * Builds a `UserSummaryDto` from a Prisma row selected with
 * `{ id, username, displayName, profileAccess, avatarUpdatedAt }` — the
 * shared shape behind comment/review authors, follower lists, etc.
 */
export function toUserSummaryDto(
  user: AvatarSource &
    Pick<UserSummaryDto, "username" | "displayName" | "profileAccess">,
): UserSummaryDto {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    profileAccess: user.profileAccess,
    avatarUrl: avatarUrl(user),
  };
}
