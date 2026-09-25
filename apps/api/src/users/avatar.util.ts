import type { UserSummaryDto } from "@loomkeep/shared";
import sharp from "sharp";

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

/** Longest side an avatar is stored at — it is never displayed larger. */
const AVATAR_MAX_DIMENSION = 512;

/** What every avatar is stored as, whatever was uploaded. */
export const STORED_AVATAR_MIME_TYPE = "image/webp";

/**
 * Normalises an uploaded avatar: re-encoded to WebP, bounded to
 * {@link AVATAR_MAX_DIMENSION}, and stripped of everything that isn't pixels.
 *
 * That last part is the point. The bytes used to be stored exactly as
 * uploaded and served back with a year-long immutable cache, so a photo taken
 * on a phone published its EXIF block — which routinely carries **GPS
 * coordinates** and a capture timestamp. The web app resizes through a canvas
 * before uploading (which drops them), but the API accepts any client, so
 * that was a convention rather than a guarantee.
 *
 * Re-encoding also collapses the polyglot-file class by construction: what
 * gets stored is sharp's own output, not the caller's bytes.
 *
 * `rotate()` before the strip, not after: it applies the EXIF orientation
 * flag while it still exists, otherwise portrait phone photos come out
 * sideways. sharp drops metadata unless `withMetadata()` is called, so
 * nothing else survives.
 *
 * Throws on anything it cannot decode — the caller turns that into a 400.
 *
 * Returns a plain Uint8Array rather than sharp's Buffer: Prisma's Bytes
 * column is typed against a non-shared ArrayBuffer, which Buffer no longer
 * guarantees.
 */
export async function reencodeAvatar(
  buffer: Buffer,
): Promise<Uint8Array<ArrayBuffer>> {
  const encoded = await sharp(buffer)
    .rotate()
    .resize({
      width: AVATAR_MAX_DIMENSION,
      height: AVATAR_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();

  return new Uint8Array(encoded);
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
