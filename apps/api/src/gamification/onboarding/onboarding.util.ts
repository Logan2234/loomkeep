import {
  BookStatus,
  GameStatus,
  MusicStatus,
  type OnboardingStepKey,
} from "@loomkeep/shared";
import type { PrismaService } from "../../prisma/prisma.service";

/**
 * Whether `userId` has genuinely performed the action behind each onboarding
 * step, re-derived live from the real tables every time — there is no event
 * log of "did this step" to go stale, so completing step 3 before ever
 * opening the checklist still shows up as done the moment it's read (see the
 * [G8] design discussion). `checkPremiereSeance` (achievements/registry.ts)
 * reuses this exact function so the checklist and the completion achievement
 * can never disagree on what counts as done.
 */
export async function computeOnboardingDoneMap(
  prisma: PrismaService,
  userId: string,
): Promise<Record<OnboardingStepKey, boolean>> {
  const [
    libraryEntry,
    gameEntry,
    bookEntry,
    musicEntry,
    completedLibraryEntry,
    completedGameEntry,
    completedBookEntry,
    completedMusicEntry,
    review,
    user,
    importRun,
    list,
    comment,
  ] = await Promise.all([
    prisma.libraryEntry.findFirst({ where: { userId }, select: { id: true } }),
    prisma.gameEntry.findFirst({ where: { userId }, select: { id: true } }),
    prisma.bookEntry.findFirst({ where: { userId }, select: { id: true } }),
    prisma.musicEntry.findFirst({ where: { userId }, select: { id: true } }),
    prisma.libraryEntry.findFirst({
      where: { userId, status: "COMPLETED" },
      select: { id: true },
    }),
    prisma.gameEntry.findFirst({
      where: { userId, status: GameStatus.COMPLETED },
      select: { id: true },
    }),
    prisma.bookEntry.findFirst({
      where: { userId, status: BookStatus.READ },
      select: { id: true },
    }),
    prisma.musicEntry.findFirst({
      where: { userId, status: MusicStatus.LISTENED },
      select: { id: true },
    }),
    prisma.review.findFirst({ where: { userId }, select: { id: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true, bio: true },
    }),
    prisma.importRun.findFirst({
      where: { userId, status: "SUCCESS" },
      select: { id: true },
    }),
    prisma.list.findFirst({ where: { userId }, select: { id: true } }),
    prisma.comment.findFirst({
      where: { authorId: userId, deletedAt: null },
      select: { id: true },
    }),
  ]);

  return {
    add_title: !!(libraryEntry ?? gameEntry ?? bookEntry ?? musicEntry),
    mark_complete: !!(
      completedLibraryEntry ??
      completedGameEntry ??
      completedBookEntry ??
      completedMusicEntry
    ),
    rate: review !== null,
    complete_profile: !!user?.avatar && !!user.bio?.trim(),
    import: importRun !== null,
    create_list: list !== null,
    comment: comment !== null,
  };
}
