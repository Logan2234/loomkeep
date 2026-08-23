import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import type { User } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import type { HibpService } from "../common/hibp.service";
import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { SecurityEventService } from "../security/security-event.service";
import { AuthService } from "./auth.service";
import type { TurnstileService } from "./turnstile.service";

const SECRETS: Record<string, string> = {
  JWT_ACCESS_SECRET: "access-secret",
  JWT_REFRESH_SECRET: "refresh-secret",
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "alice@example.com",
    username: "alice",
    displayName: "Alice",
    passwordHash: "irrelevant",
    birthDate: null,
    allowAdultContent: false,
    notifyEmail: true,
    notifyPush: true,
    role: "USER",
    locale: "fr",
    enabledDomains: ["MOVIE", "SERIES", "ANIME", "GAME", "BOOK"],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as User;
}

function makeService(adminEmail?: string, registrationEnabled?: string) {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    userDevice: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
    },
    userToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  } as unknown as PrismaService;

  const jwtService = {
    signAsync: jest
      .fn()
      .mockImplementation(async (payload: Record<string, unknown>) =>
        payload.jti ? `refresh-${payload.jti}` : `access-${payload.sub}`,
      ),
    verifyAsync: jest.fn().mockResolvedValue({}),
  } as unknown as JwtService;

  const configService = {
    getOrThrow: jest.fn((key: string) => SECRETS[key]),
    get: jest.fn((key: string) => {
      if (key === "ADMIN_EMAIL") return adminEmail;
      if (key === "REGISTRATION_ENABLED") return registrationEnabled;
      return undefined;
    }),
  } as unknown as ConfigService;

  const mail = {
    sendWelcome: jest.fn(),
    sendVerifyEmail: jest.fn(),
    sendPasswordResetLink: jest.fn(),
    sendPasswordChanged: jest.fn(),
    sendNewDeviceLogin: jest.fn(),
  } as unknown as MailService;

  const security = {
    record: jest.fn(),
  } as unknown as SecurityEventService;

  const turnstile = {
    verify: jest.fn().mockResolvedValue(true),
  } as unknown as TurnstileService;

  const hibp = {
    isPasswordPwned: jest.fn().mockResolvedValue(false),
  } as unknown as HibpService;

  const flags = {
    isEnabled: jest.fn((_name: string, fallback: boolean) => fallback),
  } as unknown as FeatureFlagsService;

  const service = new AuthService(
    prisma,
    jwtService,
    configService,
    mail,
    security,
    turnstile,
    hibp,
    flags,
  );

  return {
    service,
    prisma,
    jwtService,
    configService,
    mail,
    security,
    turnstile,
    hibp,
    flags,
  };
}

describe("AuthService.register", () => {
  it("throws ForbiddenException when registration is disabled", async () => {
    const { service, prisma, turnstile } = makeService(undefined, "false");

    await expect(
      service.register({
        email: "alice@example.com",
        password: "secret1234",
        displayName: "Alice",
        acceptedTerms: true,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(turnstile.verify).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("throws BadRequestException when Turnstile verification fails", async () => {
    const { service, prisma, turnstile } = makeService();
    (turnstile.verify as jest.Mock).mockResolvedValue(false);

    await expect(
      service.register({
        email: "alice@example.com",
        password: "secret1234",
        displayName: "Alice",
        acceptedTerms: true,
        turnstileToken: "bad-token",
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("throws ConflictException when the email is already taken", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(makeUser());

    await expect(
      service.register({
        email: "alice@example.com",
        password: "secret1234",
        displayName: "Alice",
        acceptedTerms: true,
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("throws BadRequestException when the password has appeared in a data breach", async () => {
    const { service, prisma, hibp } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (hibp.isPasswordPwned as jest.Mock).mockResolvedValue(true);

    await expect(
      service.register({
        email: "alice@example.com",
        password: "secret1234",
        displayName: "Alice",
        acceptedTerms: true,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("creates the user with a bcrypt hash, opens a session and sends welcome/verify emails", async () => {
    const { service, prisma, mail, security } = makeService();
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // email uniqueness check
      .mockResolvedValueOnce(null); // username uniqueness check
    (prisma.user.create as jest.Mock).mockImplementation(
      async ({ data }: { data: Partial<User> }) => makeUser(data),
    );

    const result = await service.register({
      email: "alice@example.com",
      password: "secret1234",
      displayName: "Alice",
      acceptedTerms: true,
    });

    const createArgs = (prisma.user.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.email).toBe("alice@example.com");
    expect(
      await bcrypt.compare("secret1234", createArgs.data.passwordHash),
    ).toBe(true);
    expect(createArgs.data.username).toBe("alice");
    expect(createArgs.data.acceptedTermsAt).toBeInstanceOf(Date);
    expect(createArgs.data.acceptedTermsVersion).toBeTruthy();

    expect(result.user.email).toBe("alice@example.com");
    expect(result.tokens.accessToken).toBeTruthy();
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(prisma.userToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "EMAIL_VERIFICATION" }),
      }),
    );
    expect(mail.sendWelcome).toHaveBeenCalledWith("alice@example.com", "Alice");
    expect(mail.sendVerifyEmail).toHaveBeenCalledWith(
      "alice@example.com",
      expect.any(String),
    );
    expect(security.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "USER_REGISTERED",
        identifier: "alice@example.com",
      }),
    );
  });

  it("appends a random suffix when the slugified username is taken", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // email uniqueness
      .mockResolvedValueOnce(makeUser()) // "alice" taken
      .mockResolvedValueOnce(null); // suffixed candidate free
    (prisma.user.create as jest.Mock).mockImplementation(
      async ({ data }: { data: Partial<User> }) => makeUser(data),
    );

    await service.register({
      email: "alice@example.com",
      password: "secret1234",
      displayName: "Alice",
      acceptedTerms: true,
    });

    const createArgs = (prisma.user.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.username).toMatch(/^alice.+/);
  });
});

describe("AuthService.login", () => {
  it("throws UnauthorizedException when no user matches the identifier", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.login({ identifier: "nobody", password: "whatever" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the password doesn't match", async () => {
    const { service, prisma, security } = makeService();
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({ passwordHash });
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(user);

    await expect(
      service.login({ identifier: "alice@example.com", password: "wrong" }),
    ).rejects.toThrow(UnauthorizedException);
    expect(security.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "LOGIN_FAILED",
        userId: user.id,
        identifier: "alice@example.com",
      }),
    );
  });

  it("returns tokens and records a session on success", async () => {
    const { service, prisma } = makeService();
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({ passwordHash });
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(user);

    const result = await service.login({
      identifier: "alice@example.com",
      password: "correct-password",
    });

    expect(result.user.id).toBe(user.id);
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();
    expect(prisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: user.id }),
      }),
    );
  });

  it("bumps lastActiveAt and clears any pending inactivity warning (LK-C06)", async () => {
    const { service, prisma } = makeService();
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({ passwordHash });
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(user);

    await service.login({
      identifier: "alice@example.com",
      password: "correct-password",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { lastActiveAt: expect.any(Date), inactivityWarningSentAt: null },
    });
  });

  it("drops any prior session for the same device before recording the new one", async () => {
    const { service, prisma } = makeService();
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({ passwordHash });
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(user);

    await service.login(
      { identifier: "alice@example.com", password: "correct-password" },
      "some-user-agent",
    );

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: user.id, userAgent: "some-user-agent" },
    });
  });

  it("alerts by email and logs a security event when the device has never been seen", async () => {
    const { service, prisma, mail, security } = makeService();
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({ passwordHash });
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(user);
    (prisma.userDevice.findUnique as jest.Mock).mockResolvedValue(null);

    await service.login(
      { identifier: "alice@example.com", password: "correct-password" },
      "Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36",
      "203.0.113.42",
    );

    expect(prisma.userDevice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: user.id,
          deviceKey: "Chrome · Windows",
        }),
      }),
    );
    expect(mail.sendNewDeviceLogin).toHaveBeenCalledWith(
      user.email,
      "Chrome · Windows",
      "203.0.113.42",
    );
    expect(security.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "NEW_DEVICE_LOGIN",
        userId: user.id,
        identifier: user.email,
      }),
    );
  });

  it("does not alert when logging in again from an already-known device", async () => {
    const { service, prisma, mail, security } = makeService();
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({ passwordHash });
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(user);
    (prisma.userDevice.findUnique as jest.Mock).mockResolvedValue({
      id: "device-1",
      userId: user.id,
      deviceKey: "Chrome · Windows",
      userAgent: "some-old-ua",
    });

    await service.login(
      { identifier: "alice@example.com", password: "correct-password" },
      "Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36",
    );

    expect(prisma.userDevice.create).not.toHaveBeenCalled();
    expect(prisma.userDevice.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "device-1" } }),
    );
    expect(mail.sendNewDeviceLogin).not.toHaveBeenCalled();
    expect(security.record).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "NEW_DEVICE_LOGIN" }),
    );
  });
});

describe("AuthService admin bootstrap (ADMIN_EMAIL)", () => {
  it("grants the ADMIN role on login when the email matches", async () => {
    const { service, prisma } = makeService("alice@example.com");
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({ passwordHash, role: "USER" });
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(user);
    (prisma.user.update as jest.Mock).mockImplementation(
      async ({ data }: { data: Partial<User> }) =>
        makeUser({ ...user, ...data }),
    );

    const result = await service.login({
      identifier: "alice@example.com",
      password: "correct-password",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });
    expect(result.user.role).toBe("ADMIN");
  });

  it("matches the email case-insensitively", async () => {
    const { service, prisma } = makeService("Alice@Example.com");
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({ passwordHash, role: "USER" });
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(user);
    (prisma.user.update as jest.Mock).mockImplementation(
      async ({ data }: { data: Partial<User> }) =>
        makeUser({ ...user, ...data }),
    );

    await service.login({
      identifier: "alice@example.com",
      password: "correct-password",
    });

    expect(prisma.user.update).toHaveBeenCalled();
  });

  it("is idempotent: no update when the role is already ADMIN", async () => {
    const { service, prisma } = makeService("alice@example.com");
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({ passwordHash, role: "ADMIN" });
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(user);

    await service.login({
      identifier: "alice@example.com",
      password: "correct-password",
    });

    expect(prisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: expect.anything() }),
      }),
    );
  });

  it("does not promote a non-matching account", async () => {
    const { service, prisma } = makeService("admin@example.com");
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({ passwordHash, role: "USER" });
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(user);

    const result = await service.login({
      identifier: "alice@example.com",
      password: "correct-password",
    });

    expect(prisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: expect.anything() }),
      }),
    );
    expect(result.user.role).toBe("USER");
  });

  it("does nothing when ADMIN_EMAIL is unset (hosted mode)", async () => {
    const { service, prisma } = makeService();
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({ passwordHash, role: "USER" });
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(user);

    await service.login({
      identifier: "alice@example.com",
      password: "correct-password",
    });

    expect(prisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: expect.anything() }),
      }),
    );
  });
});

describe("AuthService.refresh", () => {
  it("throws UnauthorizedException when the JWT itself fails verification", async () => {
    const { service, jwtService } = makeService();
    (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error("bad"));

    await expect(service.refresh("some-token")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("throws UnauthorizedException when no matching session is stored", async () => {
    const { service, prisma } = makeService();
    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.refresh("some-token")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("throws UnauthorizedException when the stored session already expired", async () => {
    const { service, prisma } = makeService();
    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      id: "rt-1",
      expiresAt: new Date(Date.now() - 1000),
      user: makeUser(),
    });

    await expect(service.refresh("some-token")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("rotates the stored token in place and returns a fresh pair", async () => {
    const { service, prisma } = makeService();
    const user = makeUser();
    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      id: "rt-1",
      tokenHash: hashToken("old-token"),
      expiresAt: new Date(Date.now() + 1000),
      user,
    });

    const tokens = await service.refresh("old-token");

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rt-1" },
        data: expect.objectContaining({
          tokenHash: hashToken(tokens.refreshToken),
        }),
      }),
    );
  });

  it("bumps lastActiveAt and clears any pending inactivity warning (LK-C06)", async () => {
    const { service, prisma } = makeService();
    const user = makeUser();
    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      id: "rt-1",
      tokenHash: hashToken("old-token"),
      expiresAt: new Date(Date.now() + 1000),
      user,
    });

    await service.refresh("old-token");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { lastActiveAt: expect.any(Date), inactivityWarningSentAt: null },
    });
  });
});

describe("AuthService.listSessions", () => {
  it("prunes expired sessions before listing, so dead ones don't linger as phantom devices", async () => {
    const { service, prisma } = makeService();
    (prisma.refreshToken.findMany as jest.Mock).mockResolvedValue([]);

    await service.listSessions("user-1");

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", expiresAt: { lt: expect.any(Date) } },
    });
    expect(prisma.refreshToken.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
  });
});

describe("AuthService.revokeAllSessions", () => {
  it("deletes every refresh token for the account, no exception", async () => {
    const { service, prisma } = makeService();

    await service.revokeAllSessions("user-1");

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });
});

describe("AuthService.logout", () => {
  it("deletes the refresh token matching the presented value's hash", async () => {
    const { service, prisma } = makeService();

    await service.logout("some-refresh-token");

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashToken("some-refresh-token") },
    });
  });
});

describe("AuthService.requestPasswordReset", () => {
  it("does nothing when the email is unknown", async () => {
    const { service, prisma, mail } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await service.requestPasswordReset("nobody@example.com");

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mail.sendPasswordResetLink).not.toHaveBeenCalled();
  });

  it("issues a token, clears any previous ones and emails the link", async () => {
    const { service, prisma, mail } = makeService();
    const user = makeUser();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

    await service.requestPasswordReset(user.email);

    expect(prisma.userToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: user.id, type: "PASSWORD_RESET" },
    });
    expect(prisma.userToken.create).toHaveBeenCalledTimes(1);
    const createArgs = (prisma.userToken.create as jest.Mock).mock.calls[0][0];
    expect(createArgs.data.userId).toBe(user.id);
    expect(createArgs.data.type).toBe("PASSWORD_RESET");

    expect(mail.sendPasswordResetLink).toHaveBeenCalledWith(
      user.email,
      expect.any(String),
    );
    const [, token] = (mail.sendPasswordResetLink as jest.Mock).mock.calls[0];
    expect(createArgs.data.tokenHash).toBe(hashToken(token));
  });
});

describe("AuthService.resetPassword", () => {
  it("throws UnauthorizedException when the token is unknown", async () => {
    const { service, prisma } = makeService();
    (prisma.userToken.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.resetPassword("bad-token", "new-password"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the token has expired", async () => {
    const { service, prisma } = makeService();
    (prisma.userToken.findUnique as jest.Mock).mockResolvedValue({
      userId: "user-1",
      type: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      service.resetPassword("expired-token", "new-password"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the token is of the wrong type", async () => {
    const { service, prisma } = makeService();
    (prisma.userToken.findUnique as jest.Mock).mockResolvedValue({
      userId: "user-1",
      type: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() + 1000),
    });

    await expect(
      service.resetPassword("verify-token", "new-password"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("throws BadRequestException when the new password has appeared in a data breach", async () => {
    const { service, prisma, hibp } = makeService();
    (prisma.userToken.findUnique as jest.Mock).mockResolvedValue({
      userId: "user-1",
      type: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + 1000),
      user: makeUser(),
    });
    (hibp.isPasswordPwned as jest.Mock).mockResolvedValue(true);

    await expect(
      service.resetPassword("good-token", "pwned-password"),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("updates the password, revokes every session and reset token, and emails a confirmation", async () => {
    const { service, prisma, mail, security } = makeService();
    const user = makeUser();
    (prisma.userToken.findUnique as jest.Mock).mockResolvedValue({
      userId: "user-1",
      type: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + 1000),
      user,
    });

    await service.resetPassword("good-token", "brand-new-password");

    const updateArgs = (prisma.user.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "user-1" });
    expect(
      await bcrypt.compare("brand-new-password", updateArgs.data.passwordHash),
    ).toBe(true);
    expect(prisma.userToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", type: "PASSWORD_RESET" },
    });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(mail.sendPasswordChanged).toHaveBeenCalledWith(user.email);
    expect(security.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PASSWORD_RESET",
        userId: "user-1",
        identifier: user.email,
      }),
    );
  });
});

describe("AuthService.resendVerificationEmail", () => {
  it("throws NotFoundException when the account doesn't exist", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.resendVerificationEmail("nobody")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("throws BadRequestException when already verified", async () => {
    const { service, prisma, mail } = makeService();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(
      makeUser({ emailVerified: true }),
    );

    await expect(service.resendVerificationEmail("user-1")).rejects.toThrow(
      BadRequestException,
    );
    expect(mail.sendVerifyEmail).not.toHaveBeenCalled();
  });

  it("replaces any previous token and emails a fresh link", async () => {
    const { service, prisma, mail } = makeService();
    const user = makeUser({ emailVerified: false });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

    await service.resendVerificationEmail("user-1");

    expect(prisma.userToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", type: "EMAIL_VERIFICATION" },
    });
    expect(prisma.userToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          type: "EMAIL_VERIFICATION",
        }),
      }),
    );
    expect(mail.sendVerifyEmail).toHaveBeenCalledWith(
      user.email,
      expect.any(String),
    );
  });
});

describe("AuthService.verifyEmail", () => {
  it("throws UnauthorizedException when the token is unknown", async () => {
    const { service, prisma } = makeService();
    (prisma.userToken.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.verifyEmail("bad-token")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("throws UnauthorizedException when the token has expired", async () => {
    const { service, prisma } = makeService();
    (prisma.userToken.findUnique as jest.Mock).mockResolvedValue({
      userId: "user-1",
      type: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(service.verifyEmail("expired-token")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("throws UnauthorizedException when the token is of the wrong type", async () => {
    const { service, prisma } = makeService();
    (prisma.userToken.findUnique as jest.Mock).mockResolvedValue({
      userId: "user-1",
      type: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + 1000),
    });

    await expect(service.verifyEmail("reset-token")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("marks the account verified and clears its verification tokens", async () => {
    const { service, prisma } = makeService();
    (prisma.userToken.findUnique as jest.Mock).mockResolvedValue({
      userId: "user-1",
      type: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() + 1000),
    });

    await service.verifyEmail("good-token");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { emailVerified: true },
    });
    expect(prisma.userToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", type: "EMAIL_VERIFICATION" },
    });
  });
});
