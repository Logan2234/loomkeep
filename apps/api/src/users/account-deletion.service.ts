import { Injectable } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { ListService } from "../lists/list.service";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityEventService } from "../security/security-event.service";

/**
 * Single deletion path shared by the self-service `DELETE /users/me` flow and
 * InactiveAccountService's automatic purge — both need the same
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
  ) {}

  async deleteAccount(
    userId: string,
    reason: "self" | "inactive",
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
    await this.lists.reassignOwnedListsOnAccountDeletion(userId);

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

    // The confirmation the GDPR erasure calls for; the address is used one
    // last time, after the account it belonged to is gone.
    if (account) {
      await this.mail.sendAccountDeleted(
        { email: account.email, locale: account.locale },
        reason,
      );
    }
  }
}
