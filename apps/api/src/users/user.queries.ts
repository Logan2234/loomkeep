import type { Prisma } from "@prisma/client";

// Query shapes on the users module's tables that other modules reuse. They
// live here, beside the table's owner, rather than as one copy per caller
// (docs/adr/0008-no-repository-layer.md): a column change is then made once.

/**
 * What `toUserSummaryDto()` (avatar.util.ts) needs: the author, member or
 * follower card shown next to a comment, a review, a list, a message.
 * Extend it with a spread when a caller needs a little more.
 */
export const USER_SUMMARY_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profileAccess: true,
  avatarUpdatedAt: true,
} satisfies Prisma.UserSelect;
