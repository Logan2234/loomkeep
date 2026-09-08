import { ErrorCode } from "@loomkeep/shared";

import type { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { vi, type Mock } from "vitest";
import { hashToken } from "../auth/auth.service";
import { AppException } from "../common/app.exception";
import type { HibpService } from "../common/hibp.service";
import type { EntitlementService } from "../entitlements/entitlement.service";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { SecurityEventService } from "../security/security-event.service";
import type { ProfileService } from "../social/profile.service";
import type { AccountDeletionService } from "./account-deletion.service";
import type { CsvExportService } from "./csv-export.service";
import type { DataExportService } from "./data-export.service";
import { UsersService } from "./users.service";

describe("UsersService — email change", () => {
  const userId = "user-1";
  let prisma: PrismaService;
  let mail: MailService;
  let service: UsersService;
  let passwordHash: string;

  beforeEach(async () => {
    passwordHash = await bcrypt.hash("correct-password", 4);
    prisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      emailChangeRequest: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        findFirst: vi.fn(),
      },
      $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;
    mail = {
      sendEmailChangeCode: vi.fn(),
      sendEmailChanged: vi.fn(),
    } as unknown as MailService;
    const security = { record: vi.fn() };
    const dataExport = { buildExport: vi.fn() };
    const csvExport = { buildCsv: vi.fn() };
    service = new UsersService(
      prisma,
      mail,
      security as unknown as SecurityEventService,
      dataExport as unknown as DataExportService,
      csvExport as unknown as CsvExportService,
      {} as unknown as ConfigService,
      {
        isPasswordPwned: vi.fn().mockResolvedValue(false),
      } as unknown as HibpService,
      {
        hasPremium: vi.fn().mockResolvedValue(true),
      } as unknown as EntitlementService,
      { getProfile: vi.fn() } as unknown as ProfileService,
      { deleteAccount: vi.fn() } as unknown as AccountDeletionService,
    );
  });

  describe("changeEmail", () => {
    it("rejects an incorrect current password without creating a request", async () => {
      (prisma.user.findUnique as Mock).mockResolvedValueOnce({
        id: userId,
        passwordHash,
      });

      await expect(
        service.changeEmail(userId, {
          newEmail: "new@example.com",
          currentPassword: "wrong",
        }),
      ).rejects.toBeInstanceOf(AppException);

      expect(prisma.emailChangeRequest.create).not.toHaveBeenCalled();
    });

    it("rejects submitting the current email unchanged", async () => {
      (prisma.user.findUnique as Mock).mockResolvedValueOnce({
        id: userId,
        email: "current@example.com",
        passwordHash,
      });

      await expect(
        service.changeEmail(userId, {
          newEmail: "current@example.com",
          currentPassword: "correct-password",
        }),
      ).rejects.toBeInstanceOf(AppException);

      expect(prisma.emailChangeRequest.create).not.toHaveBeenCalled();
    });

    it("creates a pending request and emails the code, without touching User.email", async () => {
      (prisma.user.findUnique as Mock)
        .mockResolvedValueOnce({ id: userId, passwordHash, locale: "en" }) // current user
        .mockResolvedValueOnce(null); // no email collision

      await service.changeEmail(userId, {
        newEmail: "new@example.com",
        currentPassword: "correct-password",
      });

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.emailChangeRequest.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(prisma.emailChangeRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            newEmail: "new@example.com",
          }),
        }),
      );
      expect(mail.sendEmailChangeCode).toHaveBeenCalledWith(
        { email: "new@example.com", locale: "en" },
        expect.stringMatching(/^\d{6}$/),
      );
    });
  });

  describe("confirmEmailChange", () => {
    function pendingRequest(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        id: "req-1",
        userId,
        newEmail: "new@example.com",
        codeHash: hashToken("123456"),
        attempts: 0,
        expiresAt: new Date(Date.now() + 60_000),
        ...overrides,
      };
    }

    it("applies the new email and notifies both addresses on a correct code", async () => {
      (prisma.user.findUnique as Mock).mockResolvedValueOnce({
        id: userId,
        email: "old@example.com",
        locale: "fr",
        passwordHash,
      });
      (prisma.emailChangeRequest.findFirst as Mock).mockResolvedValueOnce(
        pendingRequest(),
      );
      (prisma.user.update as Mock).mockResolvedValueOnce({
        id: userId,
        email: "new@example.com",
        displayName: "Alice",
        username: "alice",
        birthDate: null,
        allowAdultContent: false,
        notifyEmail: false,
        notifyPush: false,
        emailVerified: false,
        role: "USER",
        enabledDomains: [],
        createdAt: new Date(),
      });

      await service.confirmEmailChange(userId, { code: "123456" });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { email: "new@example.com" },
      });
      expect(prisma.emailChangeRequest.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(mail.sendEmailChanged).toHaveBeenCalledWith(
        "old@example.com",
        "new@example.com",
        "fr",
      );
    });

    it("rejects a wrong code and increments attempts", async () => {
      (prisma.user.findUnique as Mock).mockResolvedValueOnce({
        id: userId,
        passwordHash,
      });
      (prisma.emailChangeRequest.findFirst as Mock).mockResolvedValueOnce(
        pendingRequest(),
      );

      await expect(
        service.confirmEmailChange(userId, { code: "000000" }),
      ).rejects.toBeInstanceOf(AppException);

      expect(prisma.emailChangeRequest.update).toHaveBeenCalledWith({
        where: { id: "req-1" },
        data: { attempts: { increment: 1 } },
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("deletes the request after the max number of failed attempts", async () => {
      (prisma.user.findUnique as Mock).mockResolvedValueOnce({
        id: userId,
        passwordHash,
      });
      (prisma.emailChangeRequest.findFirst as Mock).mockResolvedValueOnce(
        pendingRequest({ attempts: 4 }),
      );

      await expect(
        service.confirmEmailChange(userId, { code: "000000" }),
      ).rejects.toBeInstanceOf(AppException);

      expect(prisma.emailChangeRequest.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(prisma.emailChangeRequest.update).not.toHaveBeenCalled();
    });

    it("rejects an expired code", async () => {
      (prisma.user.findUnique as Mock).mockResolvedValueOnce({
        id: userId,
        passwordHash,
      });
      (prisma.emailChangeRequest.findFirst as Mock).mockResolvedValueOnce(
        pendingRequest({ expiresAt: new Date(Date.now() - 1_000) }),
      );

      await expect(
        service.confirmEmailChange(userId, { code: "123456" }),
      ).rejects.toBeInstanceOf(AppException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});

describe("UsersService — updateMe mobile nav shortcuts", () => {
  const userId = "user-1";
  let prisma: PrismaService;
  let service: UsersService;

  // Minimal stored user returned by prisma.user.update, enough for toUserDto.
  function updatedUser(mobileNavShortcuts: string[]) {
    return {
      id: userId,
      email: "alice@example.com",
      username: "alice",
      displayName: "Alice",
      birthDate: null,
      allowAdultContent: false,
      notifyEmail: false,
      notifyPush: false,
      emailVerified: false,
      role: "USER",
      enabledDomains: ["MEDIA"],
      mobileNavShortcuts,
      createdAt: new Date(),
    };
  }

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ birthDate: null, allowAdultContent: false }),
        update: vi.fn(),
      },
    } as unknown as PrismaService;
    service = new UsersService(
      prisma,
      {} as unknown as MailService,
      { record: vi.fn() } as unknown as SecurityEventService,
      {} as unknown as DataExportService,
      {} as unknown as CsvExportService,
      {} as unknown as ConfigService,
      {
        isPasswordPwned: vi.fn().mockResolvedValue(false),
      } as unknown as HibpService,
      {
        hasPremium: vi.fn().mockResolvedValue(true),
      } as unknown as EntitlementService,
      { getProfile: vi.fn() } as unknown as ProfileService,
      { deleteAccount: vi.fn() } as unknown as AccountDeletionService,
    );
  });

  it("persists a valid ordered list that includes the menu launcher", async () => {
    const shortcuts = ["home", "menu", "account"];
    (prisma.user.update as Mock).mockResolvedValueOnce(updatedUser(shortcuts));

    const dto = await service.updateMe(userId, {
      mobileNavShortcuts: shortcuts,
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
        data: expect.objectContaining({ mobileNavShortcuts: shortcuts }),
      }),
    );
    expect(dto.mobileNavShortcuts).toEqual(shortcuts);
  });

  it("rejects a list missing the required menu launcher without writing", async () => {
    await expect(
      service.updateMe(userId, {
        mobileNavShortcuts: ["home", "search", "account"],
      }),
    ).rejects.toBeInstanceOf(AppException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("UsersService — updateMe newsletter opt-in timestamp", () => {
  const userId = "user-1";
  let prisma: PrismaService;
  let service: UsersService;

  function makeService(currentNotifyNewsletter: boolean) {
    prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          birthDate: null,
          allowAdultContent: false,
          notifyNewsletter: currentNotifyNewsletter,
        }),
        update: vi.fn().mockResolvedValue({
          id: userId,
          email: "alice@example.com",
          username: "alice",
          displayName: "Alice",
          birthDate: null,
          allowAdultContent: false,
          notifyEmail: false,
          notifyPush: false,
          emailVerified: false,
          role: "USER",
          enabledDomains: ["MEDIA"],
          mobileNavShortcuts: [],
          createdAt: new Date(),
        }),
      },
    } as unknown as PrismaService;
    service = new UsersService(
      prisma,
      {} as unknown as MailService,
      { record: vi.fn() } as unknown as SecurityEventService,
      {} as unknown as DataExportService,
      {} as unknown as CsvExportService,
      {} as unknown as ConfigService,
      {
        isPasswordPwned: vi.fn().mockResolvedValue(false),
      } as unknown as HibpService,
      {
        hasPremium: vi.fn().mockResolvedValue(true),
      } as unknown as EntitlementService,
      { getProfile: vi.fn() } as unknown as ProfileService,
      { deleteAccount: vi.fn() } as unknown as AccountDeletionService,
    );
  }

  it("stamps newsletterOptInAt on the false → true transition", async () => {
    makeService(false);

    await service.updateMe(userId, { notifyNewsletter: true });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ newsletterOptInAt: expect.any(Date) }),
      }),
    );
  });

  it("leaves newsletterOptInAt untouched when already opted in", async () => {
    makeService(true);

    await service.updateMe(userId, { notifyNewsletter: true });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ newsletterOptInAt: undefined }),
      }),
    );
  });

  it("leaves newsletterOptInAt untouched on opt-out", async () => {
    makeService(true);

    await service.updateMe(userId, { notifyNewsletter: false });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ newsletterOptInAt: undefined }),
      }),
    );
  });
});

describe("UsersService — uploadAvatar", () => {
  const userId = "user-1";
  let prisma: PrismaService;
  let service: UsersService;

  const PNG_MAGIC = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  function updatedUser() {
    return {
      id: userId,
      email: "alice@example.com",
      username: "alice",
      displayName: "Alice",
      birthDate: null,
      allowAdultContent: false,
      notifyEmail: false,
      notifyPush: false,
      emailVerified: false,
      role: "USER",
      enabledDomains: ["MEDIA"],
      mobileNavShortcuts: [],
      createdAt: new Date(),
      avatarUpdatedAt: new Date(),
    };
  }

  beforeEach(() => {
    prisma = {
      user: { update: vi.fn() },
    } as unknown as PrismaService;
    service = new UsersService(
      prisma,
      {} as unknown as MailService,
      { record: vi.fn() } as unknown as SecurityEventService,
      {} as unknown as DataExportService,
      {} as unknown as CsvExportService,
      {} as unknown as ConfigService,
      {
        isPasswordPwned: vi.fn().mockResolvedValue(false),
      } as unknown as HibpService,
      {
        hasPremium: vi.fn().mockResolvedValue(true),
      } as unknown as EntitlementService,
      { getProfile: vi.fn() } as unknown as ProfileService,
      { deleteAccount: vi.fn() } as unknown as AccountDeletionService,
    );
  });

  it("stores a valid PNG upload and cache-busts avatarUrl", async () => {
    (prisma.user.update as Mock).mockResolvedValueOnce(updatedUser());

    const dto = await service.uploadAvatar(userId, {
      mimeType: "image/png",
      data: PNG_MAGIC.toString("base64"),
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
        data: expect.objectContaining({ avatarMimeType: "image/png" }),
      }),
    );
    expect(dto.avatarUrl).toContain(`/users/${userId}/avatar`);
  });

  it("rejects a payload whose bytes don't match the declared mime type", async () => {
    await expect(
      service.uploadAvatar(userId, {
        mimeType: "image/png",
        data: Buffer.from("not an image").toString("base64"),
      }),
    ).rejects.toBeInstanceOf(AppException);
    await expect(
      service.uploadAvatar(userId, {
        mimeType: "image/png",
        data: Buffer.from("not an image").toString("base64"),
      }),
    ).rejects.toMatchObject({ code: ErrorCode.UserAvatarInvalidType });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an oversized decoded payload", async () => {
    const huge = Buffer.concat([PNG_MAGIC, Buffer.alloc(3 * 1024 * 1024)]);

    await expect(
      service.uploadAvatar(userId, {
        mimeType: "image/png",
        data: huge.toString("base64"),
      }),
    ).rejects.toMatchObject({ code: ErrorCode.UserAvatarTooLarge });

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("UsersService — changePassword", () => {
  const userId = "user-1";
  let prisma: PrismaService;
  let mail: MailService;
  let hibp: HibpService;
  let service: UsersService;
  let passwordHash: string;

  beforeEach(async () => {
    passwordHash = await bcrypt.hash("correct-password", 4);
    prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: userId,
          email: "alice@example.com",
          locale: "fr",
          passwordHash,
        }),
        update: vi.fn(),
      },
      refreshToken: {
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;
    mail = { sendPasswordChanged: vi.fn() } as unknown as MailService;
    hibp = {
      isPasswordPwned: vi.fn().mockResolvedValue(false),
    } as unknown as HibpService;
    service = new UsersService(
      prisma,
      mail,
      { record: vi.fn() } as unknown as SecurityEventService,
      {} as unknown as DataExportService,
      {} as unknown as CsvExportService,
      {} as unknown as ConfigService,
      hibp,
      {
        hasPremium: vi.fn().mockResolvedValue(true),
      } as unknown as EntitlementService,
      { getProfile: vi.fn() } as unknown as ProfileService,
      { deleteAccount: vi.fn() } as unknown as AccountDeletionService,
    );
  });

  it("rejects an incorrect current password without checking HIBP", async () => {
    await expect(
      service.changePassword(userId, {
        currentPassword: "wrong",
        newPassword: "Brand-new-pass1",
      }),
    ).rejects.toBeInstanceOf(AppException);

    expect(hibp.isPasswordPwned).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a new password identical to the current one without checking HIBP", async () => {
    await expect(
      service.changePassword(userId, {
        currentPassword: "correct-password",
        newPassword: "correct-password",
      }),
    ).rejects.toBeInstanceOf(AppException);

    expect(hibp.isPasswordPwned).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a new password that has appeared in a known data breach", async () => {
    (hibp.isPasswordPwned as Mock).mockResolvedValue(true);

    await expect(
      service.changePassword(userId, {
        currentPassword: "correct-password",
        newPassword: "Brand-new-pass1",
      }),
    ).rejects.toBeInstanceOf(AppException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("updates the password, revokes every session and notifies the user", async () => {
    await service.changePassword(userId, {
      currentPassword: "correct-password",
      newPassword: "Brand-new-pass1",
    });

    const updateArgs = (prisma.user.update as Mock).mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: userId });
    expect(
      await bcrypt.compare("Brand-new-pass1", updateArgs.data.passwordHash),
    ).toBe(true);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId },
    });
    expect(mail.sendPasswordChanged).toHaveBeenCalledWith({
      email: "alice@example.com",
      locale: "fr",
    });
  });
});

describe("UsersService — deleteAccount", () => {
  const userId = "user-1";
  let prisma: PrismaService;
  let accountDeletion: AccountDeletionService;
  let service: UsersService;

  beforeEach(async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: userId,
          email: "alice@example.com",
          passwordHash,
        }),
      },
    } as unknown as PrismaService;
    accountDeletion = {
      deleteAccount: vi.fn(),
    } as unknown as AccountDeletionService;
    service = new UsersService(
      prisma,
      {} as unknown as MailService,
      { record: vi.fn() } as unknown as SecurityEventService,
      {} as unknown as DataExportService,
      {} as unknown as CsvExportService,
      {} as unknown as ConfigService,
      { isPasswordPwned: vi.fn() } as unknown as HibpService,
      {
        hasPremium: vi.fn().mockResolvedValue(true),
      } as unknown as EntitlementService,
      { getProfile: vi.fn() } as unknown as ProfileService,
      accountDeletion,
    );
  });

  it("rejects an incorrect current password without deleting anything", async () => {
    await expect(
      service.deleteAccount(userId, { currentPassword: "wrong" }),
    ).rejects.toBeInstanceOf(AppException);

    expect(accountDeletion.deleteAccount).not.toHaveBeenCalled();
  });

  it("delegates to AccountDeletionService", async () => {
    await service.deleteAccount(userId, {
      currentPassword: "correct-password",
    });

    expect(accountDeletion.deleteAccount).toHaveBeenCalledWith(
      userId,
      expect.any(String),
      undefined,
    );
  });
});

describe("UsersService — deletionSummary", () => {
  const userId = "user-1";
  let prisma: PrismaService;
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      libraryEntry: { count: vi.fn().mockResolvedValue(0) },
      episodeWatch: { count: vi.fn().mockResolvedValue(0) },
      gameEntry: { count: vi.fn().mockResolvedValue(0) },
      bookEntry: { count: vi.fn().mockResolvedValue(0) },
      musicEntry: { count: vi.fn().mockResolvedValue(0) },
      list: { count: vi.fn().mockResolvedValue(0) },
      notification: { count: vi.fn().mockResolvedValue(0) },
      follow: { count: vi.fn().mockResolvedValue(0) },
      block: { count: vi.fn().mockResolvedValue(0) },
      activityEvent: { count: vi.fn().mockResolvedValue(0) },
      review: { count: vi.fn().mockResolvedValue(0) },
      comment: { count: vi.fn().mockResolvedValue(0) },
      report: { count: vi.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    service = new UsersService(
      prisma,
      {} as unknown as MailService,
      { record: vi.fn() } as unknown as SecurityEventService,
      {} as unknown as DataExportService,
      {} as unknown as CsvExportService,
      {} as unknown as ConfigService,
      {
        isPasswordPwned: vi.fn().mockResolvedValue(false),
      } as unknown as HibpService,
      {
        hasPremium: vi.fn().mockResolvedValue(true),
      } as unknown as EntitlementService,
      { getProfile: vi.fn() } as unknown as ProfileService,
      { deleteAccount: vi.fn() } as unknown as AccountDeletionService,
    );
  });

  it("returns every category, even at zero, split between deleted and anonymized", async () => {
    const summary = await service.deletionSummary(userId);

    expect(summary.deleted.map((r) => r.category)).toEqual([
      "LIBRARY",
      "WATCH_HISTORY",
      "GAMES",
      "BOOKS",
      "MUSIC",
      "LISTS",
      "NOTIFICATIONS",
      "FOLLOWS",
      "BLOCKS",
      "ACTIVITY",
    ]);
    expect(summary.anonymized.map((r) => r.category)).toEqual([
      "REVIEWS",
      "COMMENTS",
      "REPORTS",
    ]);
    expect(summary.deleted.every((r) => r.count === 0)).toBe(true);
    expect(summary.anonymized.every((r) => r.count === 0)).toBe(true);
  });

  it("sums both follow directions into a single FOLLOWS count", async () => {
    (prisma.follow.count as Mock)
      .mockResolvedValueOnce(3) // followers
      .mockResolvedValueOnce(5); // following

    const summary = await service.deletionSummary(userId);

    expect(summary.deleted.find((r) => r.category === "FOLLOWS")?.count).toBe(
      8,
    );
  });
});

describe("UsersService.getMyEntitlement", () => {
  const userId = "user-1";

  function makeService(hasPremium: boolean) {
    const entitlements = {
      hasPremium: vi.fn().mockResolvedValue(hasPremium),
    } as unknown as EntitlementService;
    return new UsersService(
      {} as unknown as PrismaService,
      {} as unknown as MailService,
      { record: vi.fn() } as unknown as SecurityEventService,
      {} as unknown as DataExportService,
      {} as unknown as CsvExportService,
      {} as unknown as ConfigService,
      { isPasswordPwned: vi.fn() } as unknown as HibpService,
      entitlements,
      { getProfile: vi.fn() } as unknown as ProfileService,
      { deleteAccount: vi.fn() } as unknown as AccountDeletionService,
    );
  }

  it("returns the user's real plan, not the premium-features-gated effective status", async () => {
    const service = makeService(false);
    await expect(service.getMyEntitlement(userId)).resolves.toEqual({
      isPremium: false,
    });
  });
});
