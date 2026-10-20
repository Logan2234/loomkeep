import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthService } from "../auth/auth.service";
import { ChatService } from "../chat/chat.service";
import { ListService } from "../lists/list.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityEventService } from "../security/security-event.service";

/**
 * Single deletion path shared by self-service, administrative deletion and
 * InactiveAccountService's automatic purge — all need the same
 * cascade behavior (owned lists with editors are reassigned rather than
 * cascade-deleted, see ListService.reassignOwnedListsOnAccountDeletion), just
 * with a different SecurityEvent detail for traceability.
 */
@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lists: ListService,
    private readonly security: SecurityEventService,
    private readonly mail: MailService,
    private readonly auth: AuthService,
    private readonly chat: ChatService,
  ) {}

  async deleteAccount(
    userId: string,
    reason: "self" | "inactive" | "admin",
    detail: string,
    userAgent?: string,
  ): Promise<void> {
    const account = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, locale: true, username: true },
    });

    // Evicts the session cache and closes the sockets too: the cascade alone
    // would leave a still-valid access token working for a few more seconds.
    await this.auth.revokeAllSessions(userId);

    // Recorded before the delete so the FK (onDelete: SetNull) still resolves;
    // the row itself survives the account's removal — see SecurityEvent.
    await this.security.record({
      type: "USER_DELETED",
      userId,
      detail,
      userAgent,
    });
    await this.security.forgetIps(userId);
    // What survives the account (SetNull) must not name the person: an email
    // change logs "old → new", a passkey or key name can be a first name, an
    // import summary or error can quote an external profile.
    await this.prisma.securityEvent.updateMany({
      where: { userId, type: { not: "USER_DELETED" } },
      data: { detail: null },
    });
    await this.prisma.importRun.updateMany({
      where: { userId },
      data: { summary: null, error: null, details: Prisma.DbNull },
    });

    if (account) {
      await this.prisma.invitation.updateMany({
        where: { email: { equals: account.email, mode: "insensitive" } },
        data: { email: null },
      });
    }

    await this.lists.reassignOwnedListsOnAccountDeletion(userId);
    await this.chat.eraseAuthor(userId);

    // Other members' notifications name the actor by username: left behind,
    // they'd point at a missing profile — or at whoever takes the name next.
    if (account) {
      await this.prisma.notification.deleteMany({
        where: {
          userId: { not: userId },
          data: { path: ["actorUsername"], equals: account.username },
        },
      });
    }

    await this.prisma.user.delete({ where: { id: userId } });
    await this.chat.purgeEmptyConversations();

    // The confirmation the GDPR erasure calls for; the address is used one
    // last time, after the account it belonged to is gone. Administrative
    // deletions already sent their moderation notice before reaching here.
    if (account && reason !== "admin") {
      await this.mail.sendAccountDeleted(
        { email: account.email, locale: account.locale },
        reason,
      );
    }
  }
}
