import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { hashToken } from "../auth/auth.service";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { SecurityEventService } from "../security/security-event.service";
import type { CsvExportService } from "./csv-export.service";
import type { DataExportService } from "./data-export.service";
import { UsersController } from "./users.controller";

function jwtPayload(sub: string): JwtPayload {
  return { sub, email: `${sub}@example.com` };
}

describe("UsersController — email change", () => {
  const userId = "user-1";
  let prisma: PrismaService;
  let mail: MailService;
  let controller: UsersController;
  let passwordHash: string;

  beforeEach(async () => {
    passwordHash = await bcrypt.hash("correct-password", 4);
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      emailChangeRequest: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    } as unknown as PrismaService;
    mail = {
      sendEmailChangeCode: jest.fn(),
      sendEmailChanged: jest.fn(),
    } as unknown as MailService;
    const security = { record: jest.fn() };
    const dataExport = { buildExport: jest.fn() };
    const csvExport = { buildCsv: jest.fn() };
    controller = new UsersController(
      prisma,
      mail,
      security as unknown as SecurityEventService,
      dataExport as unknown as DataExportService,
      csvExport as unknown as CsvExportService,
    );
  });

  describe("changeEmail", () => {
    it("rejects an incorrect current password without creating a request", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: userId,
        passwordHash,
      });

      await expect(
        controller.changeEmail(jwtPayload(userId), {
          newEmail: "new@example.com",
          currentPassword: "wrong",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.emailChangeRequest.create).not.toHaveBeenCalled();
    });

    it("creates a pending request and emails the code, without touching User.email", async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: userId, passwordHash }) // current user
        .mockResolvedValueOnce(null); // no email collision

      await controller.changeEmail(jwtPayload(userId), {
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
        "new@example.com",
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
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: userId,
        email: "old@example.com",
        passwordHash,
      });
      (prisma.emailChangeRequest.findFirst as jest.Mock).mockResolvedValueOnce(
        pendingRequest(),
      );
      (prisma.user.update as jest.Mock).mockResolvedValueOnce({
        id: userId,
        email: "new@example.com",
        displayName: "Alice",
        username: "alice",
        birthDate: null,
        allowAdultContent: false,
        notifyInApp: true,
        notifyEmail: false,
        notifyPush: false,
        emailVerified: false,
        entitlements: [],
        role: "USER",
        enabledDomains: [],
        createdAt: new Date(),
      });

      await controller.confirmEmailChange(jwtPayload(userId), {
        code: "123456",
      });

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
      );
    });

    it("rejects a wrong code and increments attempts", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: userId,
        passwordHash,
      });
      (prisma.emailChangeRequest.findFirst as jest.Mock).mockResolvedValueOnce(
        pendingRequest(),
      );

      await expect(
        controller.confirmEmailChange(jwtPayload(userId), { code: "000000" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.emailChangeRequest.update).toHaveBeenCalledWith({
        where: { id: "req-1" },
        data: { attempts: { increment: 1 } },
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("deletes the request after the max number of failed attempts", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: userId,
        passwordHash,
      });
      (prisma.emailChangeRequest.findFirst as jest.Mock).mockResolvedValueOnce(
        pendingRequest({ attempts: 4 }),
      );

      await expect(
        controller.confirmEmailChange(jwtPayload(userId), { code: "000000" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.emailChangeRequest.deleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(prisma.emailChangeRequest.update).not.toHaveBeenCalled();
    });

    it("rejects an expired code", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
        id: userId,
        passwordHash,
      });
      (prisma.emailChangeRequest.findFirst as jest.Mock).mockResolvedValueOnce(
        pendingRequest({ expiresAt: new Date(Date.now() - 1_000) }),
      );

      await expect(
        controller.confirmEmailChange(jwtPayload(userId), { code: "123456" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});

describe("UsersController — updateMe mobile nav shortcuts", () => {
  const userId = "user-1";
  let prisma: PrismaService;
  let controller: UsersController;

  // Minimal stored user returned by prisma.user.update, enough for toUserDto.
  function updatedUser(mobileNavShortcuts: string[]) {
    return {
      id: userId,
      email: "alice@example.com",
      username: "alice",
      displayName: "Alice",
      birthDate: null,
      allowAdultContent: false,
      notifyInApp: true,
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
        findUnique: jest
          .fn()
          .mockResolvedValue({ birthDate: null, allowAdultContent: false }),
        update: jest.fn(),
      },
    } as unknown as PrismaService;
    controller = new UsersController(
      prisma,
      {} as unknown as MailService,
      { record: jest.fn() } as unknown as SecurityEventService,
      {} as unknown as DataExportService,
      {} as unknown as CsvExportService,
    );
  });

  it("persists a valid ordered list that includes the menu launcher", async () => {
    const shortcuts = ["home", "menu", "account"];
    (prisma.user.update as jest.Mock).mockResolvedValueOnce(
      updatedUser(shortcuts),
    );

    const dto = await controller.updateMe(jwtPayload(userId), {
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
      controller.updateMe(jwtPayload(userId), {
        mobileNavShortcuts: ["home", "search", "account"],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("UsersController — uploadAvatar", () => {
  const userId = "user-1";
  let prisma: PrismaService;
  let controller: UsersController;

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
      notifyInApp: true,
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
      user: { update: jest.fn() },
    } as unknown as PrismaService;
    controller = new UsersController(
      prisma,
      {} as unknown as MailService,
      { record: jest.fn() } as unknown as SecurityEventService,
      {} as unknown as DataExportService,
      {} as unknown as CsvExportService,
    );
  });

  it("stores a valid PNG upload and cache-busts avatarUrl", async () => {
    (prisma.user.update as jest.Mock).mockResolvedValueOnce(updatedUser());

    const dto = await controller.uploadAvatar(jwtPayload(userId), {
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
      controller.uploadAvatar(jwtPayload(userId), {
        mimeType: "image/png",
        data: Buffer.from("not an image").toString("base64"),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects an oversized decoded payload", async () => {
    const huge = Buffer.concat([PNG_MAGIC, Buffer.alloc(3 * 1024 * 1024)]);

    await expect(
      controller.uploadAvatar(jwtPayload(userId), {
        mimeType: "image/png",
        data: huge.toString("base64"),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
