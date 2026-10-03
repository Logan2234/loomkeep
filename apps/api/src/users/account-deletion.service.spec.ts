import { vi, type Mock } from "vitest";
import type { AuthService } from "../auth/auth.service";
import type { ListService } from "../lists/list.service";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { SecurityEventService } from "../security/security-event.service";
import { AccountDeletionService } from "./account-deletion.service";

function makeService() {
  const prisma = {
    user: {
      delete: vi.fn(),
      findUnique: vi.fn().mockResolvedValue({
        email: "alice@example.com",
        locale: "en",
        username: "alice",
      }),
    },
    notification: { deleteMany: vi.fn() },
    securityEvent: { updateMany: vi.fn() },
    invitation: { updateMany: vi.fn() },
    importRun: { updateMany: vi.fn() },
  } as unknown as PrismaService;
  const lists = {
    reassignOwnedListsOnAccountDeletion: vi.fn(),
  } as unknown as ListService;
  const security = {
    record: vi.fn(),
    forgetIps: vi.fn(),
  } as unknown as SecurityEventService;

  const mail = { sendAccountDeleted: vi.fn() } as unknown as MailService;

  const auth = { revokeAllSessions: vi.fn() } as unknown as AuthService;

  const service = new AccountDeletionService(
    prisma,
    lists,
    security,
    mail,
    auth,
  );
  return { service, prisma, lists, security, mail, auth };
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

  it("cuts every session before the account goes", async () => {
    const { service, prisma, auth } = makeService();
    const calls: string[] = [];
    (auth.revokeAllSessions as Mock).mockImplementation(async () => {
      calls.push("revoke");
    });
    (prisma.user.delete as Mock).mockImplementation(async () => {
      calls.push("delete");
    });

    await service.deleteAccount("user-1", "self", "Suppression demandée");

    expect(auth.revokeAllSessions).toHaveBeenCalledWith("user-1");
    expect(calls).toEqual(["revoke", "delete"]);
  });

  it("removes other members' notifications about the account", async () => {
    const { service, prisma } = makeService();

    await service.deleteAccount("user-1", "self", "Suppression demandée");

    // They name the actor by username: left behind, they'd point at a missing
    // profile — or at whoever takes the username next.
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: { not: "user-1" },
        data: { path: ["actorUsername"], equals: "alice" },
      },
    });
  });

  it("strips what still identifies the person from the records kept", async () => {
    const { service, prisma } = makeService();

    await service.deleteAccount("user-1", "self", "Suppression demandée");

    // An email change logs "old → new"; a passkey or key name can be a name.
    expect(prisma.securityEvent.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", type: { not: "USER_DELETED" } },
      data: { detail: null },
    });
    expect(prisma.invitation.updateMany).toHaveBeenCalledWith({
      where: { email: { equals: "alice@example.com", mode: "insensitive" } },
      data: { email: null },
    });
    // A summary or an error can quote an external profile (a Steam id…).
    expect(prisma.importRun.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { summary: null, error: null },
    });
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
