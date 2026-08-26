import { Injectable } from "@nestjs/common";
import { ListService } from "../lists/list.service";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityEventService } from "../security/security-event.service";

/**
 * Single deletion path shared by the self-service `DELETE /users/me` flow and
 * InactiveAccountService's automatic purge (LK-C06) — both need the same
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
  ) {}

  async deleteAccount(
    userId: string,
    detail: string,
    userAgent?: string,
  ): Promise<void> {
    // Recorded before the delete so the FK (onDelete: SetNull) still resolves;
    // the row itself survives the account's removal — see SecurityEvent.
    await this.security.record({
      type: "USER_DELETED",
      userId,
      detail,
      userAgent,
    });
    await this.lists.reassignOwnedListsOnAccountDeletion(userId);
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
