import type { ListService } from "../lists/list.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { SecurityEventService } from "../security/security-event.service";
import { AccountDeletionService } from "./account-deletion.service";

function makeService() {
  const prisma = {
    user: { delete: jest.fn() },
  } as unknown as PrismaService;
  const lists = {
    reassignOwnedListsOnAccountDeletion: jest.fn(),
  } as unknown as ListService;
  const security = { record: jest.fn() } as unknown as SecurityEventService;

  const service = new AccountDeletionService(prisma, lists, security);
  return { service, prisma, lists, security };
}

describe("AccountDeletionService.deleteAccount", () => {
  it("records USER_DELETED, reassigns owned lists, then deletes the account", async () => {
    const { service, prisma, lists, security } = makeService();
    const calls: string[] = [];
    (security.record as jest.Mock).mockImplementation(async () => {
      calls.push("record");
    });
    (lists.reassignOwnedListsOnAccountDeletion as jest.Mock).mockImplementation(
      async () => {
        calls.push("reassign");
      },
    );
    (prisma.user.delete as jest.Mock).mockImplementation(async () => {
      calls.push("delete");
    });

    await service.deleteAccount(
      "user-1",
      "Suppression automatique pour inactivité (>36 mois, LK-C06)",
    );

    expect(security.record).toHaveBeenCalledWith({
      type: "USER_DELETED",
      userId: "user-1",
      detail: "Suppression automatique pour inactivité (>36 mois, LK-C06)",
      userAgent: undefined,
    });
    expect(lists.reassignOwnedListsOnAccountDeletion).toHaveBeenCalledWith(
      "user-1",
    );
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
    expect(calls).toEqual(["record", "reassign", "delete"]);
  });
});
