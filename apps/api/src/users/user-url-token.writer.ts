import type { PrismaService } from "../prisma/prisma.service";

/** The secrets of UserUrlToken, one per public URL that can't send a header. */
export type UserUrlTokenKind =
  | "calendarToken"
  | "activityFeedToken"
  | "arrToken"
  | "newsletterUnsubscribeToken";

/**
 * Stores `token` as the user's secret of that kind, replacing the previous
 * one (which stops working). The one write to UserUrlToken: the feeds of
 * ee/ and the newsletter each own a column, the users module the table.
 */
export async function saveUserUrlToken(
  prisma: PrismaService,
  userId: string,
  kind: UserUrlTokenKind,
  token: string,
): Promise<void> {
  await prisma.userUrlToken.upsert({
    where: { userId },
    create: { userId, [kind]: token },
    update: { [kind]: token },
  });
}
