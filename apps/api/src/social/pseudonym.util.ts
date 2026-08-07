import { ProfileAccess, type UserSummaryDto } from "@loomkeep/shared";

/**
 * Derives a stable-but-uncorrelatable display pseudonym for a Figurant
 * (GHOST) author: same target always shows the same pseudo, but the same
 * author shows a different one on another target, so activity can't be
 * traced across threads. Purely a display value — nothing is persisted.
 * Not cryptographic; just needs to be stable, a cosmetic identifier only.
 */
export function derivePseudonym(
  authorId: string,
  targetType: string,
  targetId: string,
): string {
  const seed = `${authorId}:${targetType}:${targetId}`;
  let hash = 0;

  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(hash, 31) + seed.charCodeAt(i)) >>> 0;
  }

  const num = (hash % 900000) + 100000;
  return `Figurant n°${num}`;
}

/**
 * Replaces a GHOST author's real identity with their derived pseudonym for a
 * given viewer/target — a no-op for non-GHOST authors and for the author
 * viewing their own content (they always see themselves as-is).
 */
export function anonymizeAuthor(
  author: UserSummaryDto,
  viewerId: string,
  targetType: string,
  targetId: string,
): UserSummaryDto {
  if (author.profileAccess !== ProfileAccess.GHOST || author.id === viewerId) {
    return author;
  }

  return {
    ...author,
    username: "",
    displayName: derivePseudonym(author.id, targetType, targetId),
    avatarUrl: null,
    anonymized: true,
  };
}
