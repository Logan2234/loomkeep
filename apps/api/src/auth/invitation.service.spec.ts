import { ErrorCode } from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";
import type { Invitation, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { vi, type Mock } from "vitest";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import { InvitationService, invitationStatus } from "./invitation.service";

const NOW = new Date("2026-09-28T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60_000;

function makeInvitation(overrides: Partial<Invitation> = {}) {
  return {
    id: "inv-1",
    tokenHash: "hash",
    createdById: "admin-1",
    email: null,
    label: null,
    maxUses: 1,
    useCount: 0,
    tokenIssuedAt: NOW,
    expiresAt: new Date(NOW.getTime() + 7 * DAY_MS),
    revokedAt: null,
    emailedAt: null,
    createdAt: NOW,
    createdBy: { displayName: "Logan" },
    redeemedBy: [],
    ...overrides,
  };
}

function makeService({ smtp = true }: { smtp?: boolean } = {}) {
  const prisma = {
    invitation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }: { data: Partial<Invitation> }) =>
        makeInvitation(data),
      ),
      update: vi.fn(async ({ data }: { data: Partial<Invitation> }) =>
        makeInvitation(data),
      ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      fields: { maxUses: "maxUses-ref" },
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string } }) =>
        where.id ? { displayName: "Logan", locale: "fr" } : null,
      ),
    },
  } as unknown as PrismaService;
  const mail = {
    isConfigured: vi.fn().mockReturnValue(smtp),
    sendInvitation: vi.fn(),
  } as unknown as MailService;
  const config = {
    get: vi.fn((key: string) =>
      key === "WEB_ORIGIN"
        ? "https://app.example.com/,https://other.example.com"
        : undefined,
    ),
  } as unknown as ConfigService;

  return {
    service: new InvitationService(prisma, mail, config),
    prisma,
    mail,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("invitationStatus", () => {
  it("lets revoked win over used and expired", () => {
    expect(
      invitationStatus(
        makeInvitation({
          revokedAt: NOW,
          useCount: 1,
          expiresAt: new Date(NOW.getTime() - 1),
        }),
        NOW,
      ),
    ).toBe("revoked");
  });

  it("reads a full invitation as used even past its expiry", () => {
    expect(
      invitationStatus(
        makeInvitation({ useCount: 1, expiresAt: new Date(NOW.getTime() - 1) }),
        NOW,
      ),
    ).toBe("used");
  });

  it("keeps a multi-use link with room left pending", () => {
    expect(
      invitationStatus(makeInvitation({ maxUses: 5, useCount: 2 }), NOW),
    ).toBe("pending");
  });

  it("expires at expiresAt", () => {
    expect(invitationStatus(makeInvitation({ expiresAt: NOW }), NOW)).toBe(
      "expired",
    );
  });
});

describe("InvitationService.create", () => {
  it("stores only the token's hash and returns the raw link once", async () => {
    const { service, prisma } = makeService();

    const result = await service.create("admin-1", {
      maxUses: 3,
      validityDays: 7,
    });

    const { data } = (prisma.invitation.create as Mock).mock.calls[0][0];
    const token = new URL(result.url).searchParams.get("invite")!;
    expect(
      result.url.startsWith("https://app.example.com/register?invite="),
    ).toBe(true);
    expect(data.tokenHash).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(data.maxUses).toBe(3);
    expect(data.expiresAt).toEqual(new Date(NOW.getTime() + 7 * DAY_MS));
    expect(result.emailed).toBe(false);
  });

  it("binds an address to a single place and mails it the link", async () => {
    const { service, prisma, mail } = makeService();

    const result = await service.create("admin-1", {
      email: "bob@example.com",
      maxUses: 5,
      validityDays: 1,
    });

    const { data } = (prisma.invitation.create as Mock).mock.calls[0][0];
    expect(data.maxUses).toBe(1);
    expect(mail.sendInvitation).toHaveBeenCalledWith(
      { email: "bob@example.com", locale: "fr" },
      "Logan",
      result.url,
      data.expiresAt,
    );
    expect(result.emailed).toBe(true);
    expect(result.invitation.emailedAt).not.toBeNull();
  });

  it("still returns the link without SMTP, just unmailed", async () => {
    const { service, mail } = makeService({ smtp: false });

    const result = await service.create("admin-1", {
      email: "bob@example.com",
      maxUses: 1,
      validityDays: 7,
    });

    expect(mail.sendInvitation).not.toHaveBeenCalled();
    expect(result.emailed).toBe(false);
    expect(result.url).toContain("/register?invite=");
  });

  it("refuses an address that already has an account", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValueOnce({ id: "user-2" });

    await expect(
      service.create("admin-1", {
        email: "taken@example.com",
        maxUses: 1,
        validityDays: 7,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.AdminInvitationEmailRegistered });
    expect(prisma.invitation.create).not.toHaveBeenCalled();
  });

  it("refuses a second pending invitation for the same address", async () => {
    const { service, prisma } = makeService();
    (prisma.invitation.findFirst as Mock).mockResolvedValueOnce({
      id: "inv-0",
    });

    await expect(
      service.create("admin-1", {
        email: "bob@example.com",
        maxUses: 1,
        validityDays: 7,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.AdminInvitationAlreadyPending });
  });
});

describe("InvitationService.renew", () => {
  it("mints a new token and restarts the original validity", async () => {
    const { service, prisma } = makeService();
    (prisma.invitation.findUnique as Mock).mockResolvedValue(
      makeInvitation({
        tokenIssuedAt: new Date(NOW.getTime() - 40 * DAY_MS),
        expiresAt: new Date(NOW.getTime() - 10 * DAY_MS),
      }),
    );

    await service.renew("admin-1", "inv-1");

    const { data } = (prisma.invitation.update as Mock).mock.calls[0][0];
    expect(data.tokenHash).not.toBe("hash");
    expect(data.tokenIssuedAt).toEqual(NOW);
    expect(data.expiresAt).toEqual(new Date(NOW.getTime() + 30 * DAY_MS));
  });

  it.each([
    ["revoked", { revokedAt: NOW }],
    ["used", { useCount: 1 }],
  ])("refuses a %s invitation", async (_status, overrides) => {
    const { service, prisma } = makeService();
    (prisma.invitation.findUnique as Mock).mockResolvedValue(
      makeInvitation(overrides),
    );

    await expect(service.renew("admin-1", "inv-1")).rejects.toMatchObject({
      code: ErrorCode.AdminInvitationNotRenewable,
    });
  });

  it("throws admin.invitation_not_found for an unknown id", async () => {
    const { service, prisma } = makeService();
    (prisma.invitation.findUnique as Mock).mockResolvedValue(null);

    await expect(service.renew("admin-1", "nope")).rejects.toMatchObject({
      code: ErrorCode.AdminInvitationNotFound,
    });
  });
});

describe("InvitationService.preview / findRedeemableFor", () => {
  it("describes a pending invitation", async () => {
    const { service, prisma } = makeService();
    (prisma.invitation.findUnique as Mock).mockResolvedValue(
      makeInvitation({ email: "bob@example.com" }),
    );

    await expect(service.preview("raw")).resolves.toEqual({
      inviterName: "Logan",
      email: "bob@example.com",
      expiresAt: new Date(NOW.getTime() + 7 * DAY_MS).toISOString(),
    });
    expect(prisma.invitation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tokenHash: createHash("sha256").update("raw").digest("hex") },
      }),
    );
  });

  it("tells an expired link apart", async () => {
    const { service, prisma } = makeService();
    (prisma.invitation.findUnique as Mock).mockResolvedValue(
      makeInvitation({ expiresAt: new Date(NOW.getTime() - 1) }),
    );

    await expect(service.preview("raw")).rejects.toMatchObject({
      code: ErrorCode.AuthInvitationExpired,
    });
  });

  it.each([
    ["unknown", null],
    ["revoked", makeInvitation({ revokedAt: NOW })],
    ["used up", makeInvitation({ useCount: 1 })],
  ])("reads an %s link as invalid", async (_case, row) => {
    const { service, prisma } = makeService();
    (prisma.invitation.findUnique as Mock).mockResolvedValue(row);

    await expect(service.preview("raw")).rejects.toMatchObject({
      code: ErrorCode.AuthInvalidInvitation,
    });
  });

  it("refuses another address than the bound one", async () => {
    const { service, prisma } = makeService();
    (prisma.invitation.findUnique as Mock).mockResolvedValue(
      makeInvitation({ email: "bob@example.com" }),
    );

    await expect(
      service.findRedeemableFor("raw", "eve@example.com"),
    ).rejects.toMatchObject({ code: ErrorCode.AuthInvitationEmailMismatch });
  });
});

describe("InvitationService.claim", () => {
  function tx(count: number) {
    return {
      invitation: {
        updateMany: vi.fn().mockResolvedValue({ count }),
        fields: { maxUses: "maxUses-ref" },
      },
    } as unknown as Prisma.TransactionClient;
  }

  it("takes a place only while the invitation is still open", async () => {
    const client = tx(1);

    await new InvitationService(
      {} as PrismaService,
      {} as MailService,
      { get: () => undefined } as unknown as ConfigService,
    ).claim(client, "inv-1");

    expect(client.invitation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "inv-1",
        revokedAt: null,
        expiresAt: { gt: NOW },
        useCount: { lt: "maxUses-ref" },
      },
      data: { useCount: { increment: 1 } },
    });
  });

  it("throws when the last place was taken meanwhile", async () => {
    const { service } = makeService();

    await expect(service.claim(tx(0), "inv-1")).rejects.toMatchObject({
      code: ErrorCode.AuthInvalidInvitation,
    });
  });
});

describe("InvitationService.purgeDead", () => {
  it("only drops dead invitations nobody used, past the retention window", async () => {
    const { service, prisma } = makeService();

    await service.purgeDead(NOW);

    const before = new Date(NOW.getTime() - 30 * DAY_MS);
    expect(prisma.invitation.deleteMany).toHaveBeenCalledWith({
      where: {
        useCount: 0,
        OR: [{ expiresAt: { lt: before } }, { revokedAt: { lt: before } }],
      },
    });
  });
});
