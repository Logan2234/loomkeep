import { vi, type Mock } from "vitest";
import type { ListService } from "../lists/list.service";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { SecurityEventService } from "../security/security-event.service";
import { AccountDeletionService } from "./account-deletion.service";

function makeService() {
  const prisma = {
    user: {
      delete: vi.fn(),
      findUnique: vi
        .fn()
        .mockResolvedValue({ email: "alice@example.com", locale: "en" }),
    },
  } as unknown as PrismaService;
  const lists = {
    reassignOwnedListsOnAccountDeletion: vi.fn(),
  } as unknown as ListService;
  const security = {
    record: vi.fn(),
    forgetIps: vi.fn(),
  } as unknown as SecurityEventService;

  const mail = { sendAccountDeleted: vi.fn() } as unknown as MailService;

  const service = new AccountDeletionService(prisma, lists, security, mail);
  return { service, prisma, lists, security, mail };
}

describe("AccountDeletionService.deleteAccount", () => {
  it("records USER_DELETED, forgets the IPs, reassigns owned lists, then deletes the account", async () => {
    const { service, prisma, lists, security } = makeService();
    const calls: string[] = [];
    (security.record as Mock).mockImplementation(async () => {
      calls.push("record");
    });
    (security.forgetIps as Mock).mockImplementation(async () => {
      calls.push("forget-ips");
    });
    (lists.reassignOwnedListsOnAccountDeletion as Mock).mockImplementation(
      async () => {
        calls.push("reassign");
      },
    );
    (prisma.user.delete as Mock).mockImplementation(async () => {
      calls.push("delete");
    });

    await service.deleteAccount(
      "user-1",
      "inactive",
      "Suppression automatique pour inactivité (>36 mois)",
    );

    expect(security.record).toHaveBeenCalledWith({
      type: "USER_DELETED",
      userId: "user-1",
      detail: "Suppression automatique pour inactivité (>36 mois)",
      userAgent: undefined,
    });
    expect(security.forgetIps).toHaveBeenCalledWith("user-1");
    expect(lists.reassignOwnedListsOnAccountDeletion).toHaveBeenCalledWith(
      "user-1",
    );
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: "user-1" },
    });
    expect(calls).toEqual(["record", "forget-ips", "reassign", "delete"]);
  });

  it("confirms the deletion by email, once the account is gone", async () => {
    const { service, prisma, mail } = makeService();
    const calls: string[] = [];
    (prisma.user.delete as Mock).mockImplementation(async () => {
      calls.push("delete");
    });
    (mail.sendAccountDeleted as Mock).mockImplementation(async () => {
      calls.push("mail");
    });

    await service.deleteAccount("user-1", "self", "Suppression demandée");

    expect(mail.sendAccountDeleted).toHaveBeenCalledWith(
      { email: "alice@example.com", locale: "en" },
      "self",
    );
    expect(calls).toEqual(["delete", "mail"]);
  });
});
