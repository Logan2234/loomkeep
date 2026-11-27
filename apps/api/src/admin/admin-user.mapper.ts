import type {
  AdminUserDto,
  AdminUserLibraryCountsDto,
  AdminUserSecondFactor,
} from "@loomkeep/shared/contracts";
import type { Domain, Plan } from "@loomkeep/shared/enums";
import type { Prisma } from "@prisma/client";
import { avatarUrl } from "../users/avatar.util";
import { isSuspended } from "../users/suspension.util";

/** What `toAdminUserDto` reads from a `User` row. */
export const ADMIN_USER_INCLUDE = {
  score: { select: { xp: true } },
  invitation: {
    select: { label: true, createdBy: { select: { displayName: true } } },
  },
  _count: { select: { webauthnCredentials: true } },
  consent: true,
  onboarding: true,
  preferences: true,
} satisfies Prisma.UserInclude;

export type AdminUserRow = Prisma.UserGetPayload<{
  include: typeof ADMIN_USER_INCLUDE;
}>;

export const EMPTY_LIBRARY_COUNTS: AdminUserLibraryCountsDto = {
  media: 0,
  games: 0,
  books: 0,
  music: 0,
};

/** One row of the admin users table, shared by the list and the account page. */
export function toAdminUserDto(
  u: AdminUserRow,
  extras: {
    plan: Plan;
    planExpiresAt: string | null;
    libraryCounts: AdminUserLibraryCountsDto;
    online: boolean;
  },
): AdminUserDto {
  const secondFactors: AdminUserSecondFactor[] = [];
  if (u.mfaTotpEnabled) secondFactors.push("TOTP");
  if (u.mfaEmailEnabled) secondFactors.push("EMAIL");
  if (u._count.webauthnCredentials > 0) secondFactors.push("WEBAUTHN");

  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: avatarUrl(u),
    emailVerified: u.emailVerified,
    role: u.role,
    plan: extras.plan,
    planExpiresAt: extras.planExpiresAt,
    createdAt: u.createdAt.toISOString(),
    lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
    inactivityWarningSentAt: u.inactivityWarningSentAt?.toISOString() ?? null,
    suspendedUntil: isSuspended(u) ? u.suspendedUntil!.toISOString() : null,
    deletionScheduledFor: u.deletionScheduledFor?.toISOString() ?? null,
    deletionReason: u.deletionScheduledFor ? u.deletionReason : null,
    xp: u.score?.xp ?? 0,
    invitation: u.invitation
      ? {
          label: u.invitation.label,
          createdByName: u.invitation.createdBy?.displayName ?? null,
        }
      : null,
    libraryCounts: extras.libraryCounts,
    enabledDomains: u.enabledDomains as Domain[],
    secondFactors,
    onboarded: (u.onboarding?.onboardedAt ?? null) !== null,
    online: extras.online,
  };
}
