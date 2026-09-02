import { ErrorCode, type LoginResponseDto } from "@loomkeep/shared";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import type { User } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { vi, type Mock } from "vitest";
import { AppException } from "../common/app.exception";
import type { HibpService } from "../common/hibp.service";
import type { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { SecurityEventService } from "../security/security-event.service";
import type { AuthResult } from "./auth.service";
import { AuthService } from "./auth.service";
import type { MfaService } from "./mfa.service";
import type { TurnstileService } from "./turnstile.service";

/** Login tests here all use non-MFA accounts, so the result is always the AuthResult branch. */
function asAuthResult(result: LoginResponseDto): AuthResult {
  if (result.mfaRequired) {
    throw new Error("Expected a completed login, got an MFA challenge");
  }

  return result;
}

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
    mfaTotpEnabled: false,
    mfaTotpSecretEnc: null,
    mfaEmailEnabled: false,
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
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn(),
    },
    consumedRefreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
    userDevice: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    mfaLoginChallenge: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((operation: unknown) =>
      typeof operation === "function"
        ? operation(prisma)
        : Promise.all(operation as Promise<unknown>[]),
    ),
  } as unknown as PrismaService;

  const jwtService = {
    signAsync: vi
      .fn()
      .mockImplementation(async (payload: Record<string, unknown>) =>
        payload.jti ? `refresh-${payload.jti}` : `access-${payload.sub}`,
      ),
    verifyAsync: vi.fn().mockResolvedValue({}),
  } as unknown as JwtService;

  const configService = {
    getOrThrow: vi.fn((key: string) => SECRETS[key]),
    get: vi.fn((key: string) => {
      if (key === "ADMIN_EMAIL") return adminEmail;
      if (key === "REGISTRATION_ENABLED") return registrationEnabled;
      return undefined;
    }),
  } as unknown as ConfigService;

  const mail = {
    sendWelcome: vi.fn(),
    sendVerifyEmail: vi.fn(),
    sendPasswordResetLink: vi.fn(),
    sendPasswordChanged: vi.fn(),
    sendNewDeviceLogin: vi.fn(),
    sendMfaEmailCode: vi.fn(),
  } as unknown as MailService;

  const security = {
    record: vi.fn(),
  } as unknown as SecurityEventService;

  const turnstile = {
    verify: vi.fn().mockResolvedValue(true),
  } as unknown as TurnstileService;

  const hibp = {
    isPasswordPwned: vi.fn().mockResolvedValue(false),
  } as unknown as HibpService;

  const flags = {
    isEnabled: vi.fn((_name: string, fallback: boolean) => fallback),
  } as unknown as FeatureFlagsService;

  const mfa = {
    validateTotpCode: vi.fn(),
    verifyRecoveryCode: vi.fn().mockResolvedValue(false),
  } as unknown as MfaService;

  const service = new AuthService(
    prisma,
    jwtService,
    configService,
    mail,
    security,
    turnstile,
    hibp,
    flags,
    mfa,
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
    mfa,
  };
}

describe("AuthService.register", () => {
  it("throws AppException(auth.registration_disabled) when registration is disabled", async () => {
    const { service, prisma, turnstile } = makeService(undefined, "false");

    await expect(
      service.register({
        email: "alice@example.com",
        password: "secret1234",
        displayName: "Alice",
        acceptedTerms: true,
        certifiedAge: true,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.AuthRegistrationDisabled });
    expect(turnstile.verify).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("throws AppException(auth.anti_bot_verification_failed) when Turnstile verification fails", async () => {
    const { service, prisma, turnstile } = makeService();
    (turnstile.verify as Mock).mockResolvedValue(false);

    await expect(
      service.register({
        email: "alice@example.com",
        password: "secret1234",
        displayName: "Alice",
        acceptedTerms: true,
        certifiedAge: true,
        turnstileToken: "bad-token",
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.AuthAntiBotVerificationFailed,
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("throws AppException(auth.email_already_exists) when the email is already taken", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValue(makeUser());

    await expect(
      service.register({
        email: "alice@example.com",
        password: "secret1234",
        displayName: "Alice",
        acceptedTerms: true,
        certifiedAge: true,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.AuthEmailAlreadyExists,
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("throws AppException(auth.password_breached) when the password has appeared in a data breach", async () => {
    const { service, prisma, hibp } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValue(null);
    (hibp.isPasswordPwned as Mock).mockResolvedValue(true);

    await expect(
      service.register({
        email: "alice@example.com",
        password: "secret1234",
        displayName: "Alice",
        acceptedTerms: true,
        certifiedAge: true,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.AuthPasswordBreached });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("creates the user with a bcrypt hash, opens a session and sends welcome/verify emails", async () => {
    const { service, prisma, mail, security } = makeService();
    (prisma.user.findUnique as Mock)
      .mockResolvedValueOnce(null) // email uniqueness check
      .mockResolvedValueOnce(null); // username uniqueness check
    (prisma.user.create as Mock).mockImplementation(
      async ({ data }: { data: Partial<User> }) => makeUser(data),
    );

    const result = await service.register({
      email: "alice@example.com",
      password: "secret1234",
      displayName: "Alice",
      acceptedTerms: true,
      certifiedAge: true,
    });

    const createArgs = (prisma.user.create as Mock).mock.calls[0][0];
    expect(createArgs.data.email).toBe("alice@example.com");
    expect(
      await bcrypt.compare("secret1234", createArgs.data.passwordHash),
    ).toBe(true);
    expect(createArgs.data.username).toBe("alice");
    expect(createArgs.data.acceptedTermsAt).toBeInstanceOf(Date);
    expect(createArgs.data.acceptedTermsVersion).toBeTruthy();
    expect(createArgs.data.certifiedAgeAt).toBeInstanceOf(Date);

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
      }),
    );
  });

  it("appends a random suffix when the slugified username is taken", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as Mock)
      .mockResolvedValueOnce(null) // email uniqueness
      .mockResolvedValueOnce(makeUser()) // "alice" taken
      .mockResolvedValueOnce(null); // suffixed candidate free
    (prisma.user.create as Mock).mockImplementation(
      async ({ data }: { data: Partial<User> }) => makeUser(data),
    );

    await service.register({
      email: "alice@example.com",
      password: "secret1234",
      displayName: "Alice",
      acceptedTerms: true,
      certifiedAge: true,
    });

    const createArgs = (prisma.user.create as Mock).mock.calls[0][0];
    expect(createArgs.data.username).toMatch(/^alice.+/);
  });
});

describe("AuthService.login", () => {
  it("throws AppException(auth.invalid_credentials) when no user matches the identifier", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findFirst as Mock).mockResolvedValue(null);

    await expect(
      service.login({ identifier: "nobody", password: "whatever" }),
    ).rejects.toMatchObject({ code: ErrorCode.AuthInvalidCredentials });
  });

  it("throws AppException(auth.invalid_credentials) when the password doesn't match", async () => {
    const { service, prisma, security } = makeService();
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({ passwordHash });
    (prisma.user.findFirst as Mock).mockResolvedValue(user);

    await expect(
      service.login({ identifier: "alice@example.com", password: "wrong" }),
    ).rejects.toMatchObject({ code: ErrorCode.AuthInvalidCredentials });
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
    (prisma.user.findFirst as Mock).mockResolvedValue(user);

    const result = asAuthResult(
      await service.login({
        identifier: "alice@example.com",
        password: "correct-password",
      }),
    );

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
    (prisma.user.findFirst as Mock).mockResolvedValue(user);

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
    (prisma.user.findFirst as Mock).mockResolvedValue(user);

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
    (prisma.user.findFirst as Mock).mockResolvedValue(user);
    (prisma.userDevice.findUnique as Mock).mockResolvedValue(null);

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
      }),
    );
  });

  it("does not alert when logging in again from an already-known device", async () => {
    const { service, prisma, mail, security } = makeService();
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({ passwordHash });
    (prisma.user.findFirst as Mock).mockResolvedValue(user);
    (prisma.userDevice.findUnique as Mock).mockResolvedValue({
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
    (prisma.user.findFirst as Mock).mockResolvedValue(user);
    (prisma.user.update as Mock).mockImplementation(
      async ({ data }: { data: Partial<User> }) =>
        makeUser({ ...user, ...data }),
    );

    const result = asAuthResult(
      await service.login({
        identifier: "alice@example.com",
        password: "correct-password",
      }),
    );

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
    (prisma.user.findFirst as Mock).mockResolvedValue(user);
    (prisma.user.update as Mock).mockImplementation(
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
    (prisma.user.findFirst as Mock).mockResolvedValue(user);

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
    (prisma.user.findFirst as Mock).mockResolvedValue(user);

    const result = asAuthResult(
      await service.login({
        identifier: "alice@example.com",
        password: "correct-password",
      }),
    );

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
    (prisma.user.findFirst as Mock).mockResolvedValue(user);

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
  it("throws AppException(auth.invalid_refresh_token) when the JWT itself fails verification", async () => {
    const { service, jwtService } = makeService();
    (jwtService.verifyAsync as Mock).mockRejectedValue(new Error("bad"));

    await expect(service.refresh("some-token")).rejects.toMatchObject({
      code: ErrorCode.AuthInvalidRefreshToken,
    });
  });

  it("throws AppException(auth.invalid_refresh_token) when no matching session is stored", async () => {
    const { service, prisma } = makeService();
    (prisma.refreshToken.findUnique as Mock).mockResolvedValue(null);

    await expect(service.refresh("some-token")).rejects.toMatchObject({
      code: ErrorCode.AuthInvalidRefreshToken,
    });
  });

  it("revokes the token family when a consumed refresh token is replayed", async () => {
    const { service, prisma } = makeService();
    (prisma.refreshToken.findUnique as Mock).mockResolvedValue(null);
    (prisma.consumedRefreshToken.findUnique as Mock).mockResolvedValue({
      sessionId: "rt-1",
    });

    await expect(service.refresh("replayed-token")).rejects.toMatchObject({
      code: ErrorCode.AuthInvalidRefreshToken,
    });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { id: "rt-1" },
    });
  });

  it("revokes the token family when a concurrent rotation loses the compare-and-swap", async () => {
    const { service, prisma } = makeService();
    (prisma.refreshToken.findUnique as Mock).mockResolvedValue({
      id: "rt-1",
      tokenHash: hashToken("old-token"),
      expiresAt: new Date(Date.now() + 1000),
      user: makeUser(),
    });
    (prisma.refreshToken.updateMany as Mock).mockResolvedValue({ count: 0 });

    await expect(service.refresh("old-token")).rejects.toMatchObject({
      code: ErrorCode.AuthInvalidRefreshToken,
    });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { id: "rt-1" },
    });
  });

  it("throws AppException(auth.invalid_refresh_token) when the stored session already expired", async () => {
    const { service, prisma } = makeService();
    (prisma.refreshToken.findUnique as Mock).mockResolvedValue({
      id: "rt-1",
      expiresAt: new Date(Date.now() - 1000),
      user: makeUser(),
    });

    await expect(service.refresh("some-token")).rejects.toMatchObject({
      code: ErrorCode.AuthInvalidRefreshToken,
    });
  });

  it("rotates the stored token in place and returns a fresh pair", async () => {
    const { service, prisma, jwtService } = makeService();
    const user = makeUser();
    (prisma.refreshToken.findUnique as Mock).mockResolvedValue({
      id: "rt-1",
      tokenHash: hashToken("old-token"),
      expiresAt: new Date(Date.now() + 1000),
      user,
    });

    const tokens = await service.refresh("old-token");

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rt-1", tokenHash: hashToken("old-token") },
        data: expect.objectContaining({
          tokenHash: hashToken(tokens.refreshToken),
        }),
      }),
    );
    expect(prisma.consumedRefreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: "rt-1",
        tokenHash: hashToken("old-token"),
      }),
    });
    expect(jwtService.verifyAsync).toHaveBeenCalledWith(
      "old-token",
      expect.objectContaining({
        algorithms: ["HS256"],
        issuer: "loomkeep-api",
        audience: "loomkeep-refresh",
      }),
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ sub: user.id }),
      expect.objectContaining({
        algorithm: "HS256",
        issuer: "loomkeep-api",
        audience: "loomkeep-web",
      }),
    );
  });

  it("bumps lastActiveAt and clears any pending inactivity warning (LK-C06)", async () => {
    const { service, prisma } = makeService();
    const user = makeUser();
    (prisma.refreshToken.findUnique as Mock).mockResolvedValue({
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
    (prisma.refreshToken.findMany as Mock).mockResolvedValue([]);

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
    (prisma.user.findUnique as Mock).mockResolvedValue(null);

    await service.requestPasswordReset("nobody@example.com");

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mail.sendPasswordResetLink).not.toHaveBeenCalled();
  });

  it("issues a token, clears any previous ones and emails the link", async () => {
    const { service, prisma, mail } = makeService();
    const user = makeUser();
    (prisma.user.findUnique as Mock).mockResolvedValue(user);

    await service.requestPasswordReset(user.email);

    expect(prisma.userToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: user.id, type: "PASSWORD_RESET" },
    });
    expect(prisma.userToken.create).toHaveBeenCalledTimes(1);
    const createArgs = (prisma.userToken.create as Mock).mock.calls[0][0];
    expect(createArgs.data.userId).toBe(user.id);
    expect(createArgs.data.type).toBe("PASSWORD_RESET");

    expect(mail.sendPasswordResetLink).toHaveBeenCalledWith(
      user.email,
      expect.any(String),
    );
    const [, token] = (mail.sendPasswordResetLink as Mock).mock.calls[0];
    expect(createArgs.data.tokenHash).toBe(hashToken(token));
  });
});

describe("AuthService.resetPassword", () => {
  it("throws AppException(auth.invalid_reset_token) when the token is unknown", async () => {
    const { service, prisma } = makeService();
    (prisma.userToken.findUnique as Mock).mockResolvedValue(null);

    await expect(
      service.resetPassword("bad-token", "new-password"),
    ).rejects.toMatchObject({ code: ErrorCode.AuthInvalidResetToken });
  });

  it("throws AppException(auth.invalid_reset_token) when the token has expired", async () => {
    const { service, prisma } = makeService();
    (prisma.userToken.findUnique as Mock).mockResolvedValue({
      userId: "user-1",
      type: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      service.resetPassword("expired-token", "new-password"),
    ).rejects.toMatchObject({ code: ErrorCode.AuthInvalidResetToken });
  });

  it("throws AppException(auth.invalid_reset_token) when the token is of the wrong type", async () => {
    const { service, prisma } = makeService();
    (prisma.userToken.findUnique as Mock).mockResolvedValue({
      userId: "user-1",
      type: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() + 1000),
    });

    await expect(
      service.resetPassword("verify-token", "new-password"),
    ).rejects.toMatchObject({ code: ErrorCode.AuthInvalidResetToken });
  });

  it("throws AppException(auth.password_breached) when the new password has appeared in a data breach", async () => {
    const { service, prisma, hibp } = makeService();
    (prisma.userToken.findUnique as Mock).mockResolvedValue({
      userId: "user-1",
      type: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + 1000),
      user: makeUser(),
    });
    (hibp.isPasswordPwned as Mock).mockResolvedValue(true);

    await expect(
      service.resetPassword("good-token", "pwned-password"),
    ).rejects.toMatchObject({ code: ErrorCode.AuthPasswordBreached });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("updates the password, revokes every session and reset token, and emails a confirmation", async () => {
    const { service, prisma, mail, security } = makeService();
    const user = makeUser();
    (prisma.userToken.findUnique as Mock).mockResolvedValue({
      userId: "user-1",
      type: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + 1000),
      user,
    });

    await service.resetPassword("good-token", "brand-new-password");

    const updateArgs = (prisma.user.update as Mock).mock.calls[0][0];
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
      }),
    );
  });
});

describe("AuthService.resendVerificationEmail", () => {
  it("throws AppException(auth.account_not_found) when the account doesn't exist", async () => {
    const { service, prisma } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValue(null);

    await expect(service.resendVerificationEmail("nobody")).rejects.toThrow(
      AppException,
    );
    await expect(
      service.resendVerificationEmail("nobody"),
    ).rejects.toMatchObject({ code: ErrorCode.AuthAccountNotFound });
  });

  it("throws AppException(auth.already_verified) when already verified", async () => {
    const { service, prisma, mail } = makeService();
    (prisma.user.findUnique as Mock).mockResolvedValue(
      makeUser({ emailVerified: true }),
    );

    await expect(
      service.resendVerificationEmail("user-1"),
    ).rejects.toMatchObject({
      code: ErrorCode.AuthAlreadyVerified,
    });
    expect(mail.sendVerifyEmail).not.toHaveBeenCalled();
  });

  it("replaces any previous token and emails a fresh link", async () => {
    const { service, prisma, mail } = makeService();
    const user = makeUser({ emailVerified: false });
    (prisma.user.findUnique as Mock).mockResolvedValue(user);

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
  it("throws AppException(auth.invalid_verification_token) when the token is unknown", async () => {
    const { service, prisma } = makeService();
    (prisma.userToken.findUnique as Mock).mockResolvedValue(null);

    await expect(service.verifyEmail("bad-token")).rejects.toMatchObject({
      code: ErrorCode.AuthInvalidVerificationToken,
    });
  });

  it("throws AppException(auth.invalid_verification_token) when the token has expired", async () => {
    const { service, prisma } = makeService();
    (prisma.userToken.findUnique as Mock).mockResolvedValue({
      userId: "user-1",
      type: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(service.verifyEmail("expired-token")).rejects.toMatchObject({
      code: ErrorCode.AuthInvalidVerificationToken,
    });
  });

  it("throws AppException(auth.invalid_verification_token) when the token is of the wrong type", async () => {
    const { service, prisma } = makeService();
    (prisma.userToken.findUnique as Mock).mockResolvedValue({
      userId: "user-1",
      type: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + 1000),
    });

    await expect(service.verifyEmail("reset-token")).rejects.toMatchObject({
      code: ErrorCode.AuthInvalidVerificationToken,
    });
  });

  it("marks the account verified and clears its verification tokens", async () => {
    const { service, prisma } = makeService();
    (prisma.userToken.findUnique as Mock).mockResolvedValue({
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

describe("AuthService.login — MFA challenge (LK-C17)", () => {
  it("returns mfaRequired without opening a session when a method is enabled", async () => {
    const { service, prisma } = makeService();
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({ passwordHash, mfaTotpEnabled: true });
    (prisma.user.findFirst as Mock).mockResolvedValue(user);
    (prisma.mfaLoginChallenge.create as Mock).mockResolvedValue({
      id: "challenge-1",
    });

    const result = await service.login({
      identifier: "alice@example.com",
      password: "correct-password",
    });

    expect(result).toEqual({
      mfaRequired: true,
      challengeId: "challenge-1",
      availableMethods: ["totp", "recovery"],
    });
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it("sends the emailed code and includes it as an available method", async () => {
    const { service, prisma, mail } = makeService();
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({ passwordHash, mfaEmailEnabled: true });
    (prisma.user.findFirst as Mock).mockResolvedValue(user);
    (prisma.mfaLoginChallenge.create as Mock).mockResolvedValue({
      id: "challenge-1",
    });

    const result = await service.login({
      identifier: "alice@example.com",
      password: "correct-password",
    });

    expect(mail.sendMfaEmailCode).toHaveBeenCalledWith(
      user.email,
      expect.stringMatching(/^\d{6}$/),
    );
    expect(result).toMatchObject({ availableMethods: ["email", "recovery"] });
  });

  it("does NOT send the email code when TOTP is also enabled — only once the user picks it", async () => {
    const { service, prisma, mail } = makeService();
    const passwordHash = await bcrypt.hash("correct-password", 4);
    const user = makeUser({
      passwordHash,
      mfaTotpEnabled: true,
      mfaEmailEnabled: true,
    });
    (prisma.user.findFirst as Mock).mockResolvedValue(user);
    (prisma.mfaLoginChallenge.create as Mock).mockResolvedValue({
      id: "challenge-1",
    });

    const result = await service.login({
      identifier: "alice@example.com",
      password: "correct-password",
    });

    expect(mail.sendMfaEmailCode).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      availableMethods: ["totp", "email", "recovery"],
    });
    expect(prisma.mfaLoginChallenge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailCodeHash: undefined,
          emailCodeExpiresAt: undefined,
        }),
      }),
    );
  });
});

describe("AuthService.resendMfaEmailCode", () => {
  it("generates and sends a code even when none was sent yet (first pick of the email method)", async () => {
    const { service, prisma, mail } = makeService();
    const user = makeUser({ mfaTotpEnabled: true, mfaEmailEnabled: true });
    (prisma.mfaLoginChallenge.findUnique as Mock).mockResolvedValue({
      id: "challenge-1",
      userId: user.id,
      totpAllowed: true,
      emailAllowed: true,
      emailCodeHash: null,
      emailCodeExpiresAt: null,
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      user,
    });

    await service.resendMfaEmailCode("challenge-1");

    expect(mail.sendMfaEmailCode).toHaveBeenCalledWith(
      user.email,
      expect.stringMatching(/^\d{6}$/),
    );
    expect(prisma.mfaLoginChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "challenge-1" } }),
    );
  });

  it("rejects when the method isn't actually allowed on this challenge", async () => {
    const { service, prisma } = makeService();
    (prisma.mfaLoginChallenge.findUnique as Mock).mockResolvedValue({
      id: "challenge-1",
      emailAllowed: false,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      service.resendMfaEmailCode("challenge-1"),
    ).rejects.toMatchObject({
      code: ErrorCode.AuthInvalidMfaChallenge,
    });
  });
});

describe("AuthService.verifyMfaLogin", () => {
  it("accepts a valid TOTP code and completes the session", async () => {
    const { service, prisma, mfa } = makeService();
    const user = makeUser({ mfaTotpEnabled: true, mfaTotpSecretEnc: "enc" });
    (prisma.mfaLoginChallenge.findUnique as Mock).mockResolvedValue({
      id: "challenge-1",
      userId: user.id,
      totpAllowed: true,
      emailAllowed: false,
      emailCodeHash: null,
      emailCodeExpiresAt: null,
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      user,
    });
    (mfa.validateTotpCode as Mock).mockReturnValue(true);

    const result = await service.verifyMfaLogin("challenge-1", "123456");

    expect(result.user.id).toBe(user.id);
    expect(result.tokens.accessToken).toBeTruthy();
    expect(prisma.mfaLoginChallenge.delete).toHaveBeenCalledWith({
      where: { id: "challenge-1" },
    });
  });

  it("falls back to a valid recovery code when TOTP/email don't match", async () => {
    const { service, prisma, mfa } = makeService();
    const user = makeUser({ mfaTotpEnabled: true, mfaTotpSecretEnc: "enc" });
    (prisma.mfaLoginChallenge.findUnique as Mock).mockResolvedValue({
      id: "challenge-1",
      userId: user.id,
      totpAllowed: true,
      emailAllowed: false,
      emailCodeHash: null,
      emailCodeExpiresAt: null,
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      user,
    });
    (mfa.validateTotpCode as Mock).mockReturnValue(false);
    (mfa.verifyRecoveryCode as Mock).mockResolvedValue(true);

    const result = await service.verifyMfaLogin("challenge-1", "ABCDE12345");
    expect(result.user.id).toBe(user.id);
  });

  it("increments attempts on an invalid code without consuming the challenge", async () => {
    const { service, prisma, mfa } = makeService();
    const user = makeUser({ mfaTotpEnabled: true, mfaTotpSecretEnc: "enc" });
    (prisma.mfaLoginChallenge.findUnique as Mock).mockResolvedValue({
      id: "challenge-1",
      userId: user.id,
      totpAllowed: true,
      emailAllowed: false,
      emailCodeHash: null,
      emailCodeExpiresAt: null,
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      user,
    });
    (mfa.validateTotpCode as Mock).mockReturnValue(false);
    (mfa.verifyRecoveryCode as Mock).mockResolvedValue(false);

    await expect(
      service.verifyMfaLogin("challenge-1", "000000"),
    ).rejects.toMatchObject({ code: ErrorCode.AuthMfaInvalidCode });
    expect(prisma.mfaLoginChallenge.update).toHaveBeenCalledWith({
      where: { id: "challenge-1" },
      data: { attempts: { increment: 1 } },
    });
    expect(prisma.mfaLoginChallenge.delete).not.toHaveBeenCalled();
  });

  it("deletes the challenge once the attempt cap is reached", async () => {
    const { service, prisma, mfa } = makeService();
    const user = makeUser({ mfaTotpEnabled: true, mfaTotpSecretEnc: "enc" });
    (prisma.mfaLoginChallenge.findUnique as Mock).mockResolvedValue({
      id: "challenge-1",
      userId: user.id,
      totpAllowed: true,
      emailAllowed: false,
      emailCodeHash: null,
      emailCodeExpiresAt: null,
      attempts: 4,
      expiresAt: new Date(Date.now() + 60_000),
      user,
    });
    (mfa.validateTotpCode as Mock).mockReturnValue(false);
    (mfa.verifyRecoveryCode as Mock).mockResolvedValue(false);

    await expect(
      service.verifyMfaLogin("challenge-1", "000000"),
    ).rejects.toMatchObject({ code: ErrorCode.AuthMfaTooManyAttempts });
    expect(prisma.mfaLoginChallenge.delete).toHaveBeenCalledWith({
      where: { id: "challenge-1" },
    });
    expect(prisma.mfaLoginChallenge.update).not.toHaveBeenCalled();
  });
});
