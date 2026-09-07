import type { ConfigService } from "@nestjs/config";
import type {
  User,
  WebauthnChallenge,
  WebauthnCredential,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { SecurityEventService } from "../security/security-event.service";
import { WebauthnService } from "./webauthn.service";

const CURRENT_PASSWORD = "correct";
const CURRENT_PASSWORD_HASH = bcrypt.hashSync(CURRENT_PASSWORD, 4);

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn().mockResolvedValue({
    challenge: "reg-challenge",
  }),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn().mockResolvedValue({
    challenge: "auth-challenge",
  }),
  verifyAuthenticationResponse: vi.fn(),
}));

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    passwordHash: CURRENT_PASSWORD_HASH,
    passwordlessEnabled: false,
    ...overrides,
  } as User;
}

function makeCredential(
  overrides: Partial<WebauthnCredential> = {},
): WebauthnCredential {
  return {
    id: "cred-1",
    userId: "user-1",
    credentialId: "credential-id-1",
    publicKey: Buffer.from("public-key"),
    counter: 0n,
    deviceType: "singleDevice",
    backedUp: false,
    transports: [],
    name: "YubiKey bureau",
    createdAt: new Date(),
    lastUsedAt: null,
    ...overrides,
  } as WebauthnCredential;
}

function makeService() {
  const credentials = new Map<string, WebauthnCredential>();
  const challenges = new Map<string, WebauthnChallenge>();
  const users = new Map<string, User>([["user-1", makeUser()]]);

  const prisma = {
    user: {
      findUniqueOrThrow: vi.fn(({ where }: { where: { id: string } }) => {
        const user = users.get(where.id);
        if (!user) throw new Error("not found");
        return Promise.resolve(user);
      }),
      update: vi.fn(
        ({ where, data }: { where: { id: string }; data: Partial<User> }) => {
          const user = users.get(where.id)!;
          Object.assign(user, data);
          return Promise.resolve(user);
        },
      ),
    },
    webauthnCredential: {
      count: vi.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          [...credentials.values()].filter((c) => c.userId === where.userId)
            .length,
        ),
      ),
      findMany: vi.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve(
          [...credentials.values()].filter((c) => c.userId === where.userId),
        ),
      ),
      findUnique: vi.fn(
        ({ where }: { where: { id?: string; credentialId?: string } }) =>
          Promise.resolve(
            [...credentials.values()].find((c) =>
              where.id
                ? c.id === where.id
                : c.credentialId === where.credentialId,
            ) ?? null,
          ),
      ),
      create: vi.fn(({ data }: { data: Partial<WebauthnCredential> }) => {
        const row = {
          id: "cred-new",
          createdAt: new Date(),
          lastUsedAt: null,
          ...data,
        } as WebauthnCredential;
        credentials.set(row.id, row);
        return Promise.resolve(row);
      }),
      delete: vi.fn(({ where }: { where: { id: string } }) => {
        const row = credentials.get(where.id);
        credentials.delete(where.id);
        return Promise.resolve(row);
      }),
      update: vi.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<WebauthnCredential>;
        }) => {
          const row = credentials.get(where.id)!;
          Object.assign(row, data);
          return Promise.resolve(row);
        },
      ),
    },
    webauthnChallenge: {
      create: vi.fn(({ data }: { data: Omit<WebauthnChallenge, "id"> }) => {
        const row = {
          id: `challenge-${challenges.size}`,
          ...data,
        } as WebauthnChallenge;
        challenges.set(row.id, row);
        return Promise.resolve(row);
      }),
      findUnique: vi.fn(
        ({
          where,
          include,
        }: {
          where: { id: string };
          include?: { user?: boolean };
        }) => {
          const row = challenges.get(where.id);
          if (!row) return Promise.resolve(null);
          return Promise.resolve(
            include?.user ? { ...row, user: users.get(row.userId) } : row,
          );
        },
      ),
      delete: vi.fn(({ where }: { where: { id: string } }) => {
        challenges.delete(where.id);
        return Promise.resolve();
      }),
    },
    refreshToken: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;

  const configService = {
    getOrThrow: vi.fn(() => "https://loomkeep.app"),
  } as unknown as ConfigService;

  const security = { record: vi.fn() } as unknown as SecurityEventService;

  return {
    service: new WebauthnService(prisma, configService, security),
    prisma,
    security,
    credentials,
    users,
  };
}

describe("WebauthnService.verifyRegistration", () => {
  it("stores the credential and records MFA_WEBAUTHN_ADDED on success", async () => {
    const { service, prisma, security } = makeService();
    const { verifyRegistrationResponse } =
      await import("@simplewebauthn/server");
    vi.mocked(verifyRegistrationResponse).mockResolvedValueOnce({
      verified: true,
      registrationInfo: {
        credential: {
          id: "credential-id-1",
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
          transports: ["usb"],
        },
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
      },
    } as never);

    const { webauthnChallengeId } = await service.registrationOptions(
      "user-1",
      "alice@example.com",
      "alice@example.com",
    );

    const credential = await service.verifyRegistration("user-1", {
      webauthnChallengeId,
      response: {} as never,
      name: "YubiKey bureau",
    });

    expect(credential.name).toBe("YubiKey bureau");
    expect(prisma.webauthnCredential.create).toHaveBeenCalledOnce();
    expect(security.record).toHaveBeenCalledWith(
      expect.objectContaining({ type: "MFA_WEBAUTHN_ADDED", userId: "user-1" }),
    );
  });
});

describe("WebauthnService.removeCredential", () => {
  it("disables passwordless when the last credential is removed", async () => {
    const { service, credentials, users } = makeService();
    credentials.set("cred-1", makeCredential());
    users.set("user-1", makeUser({ passwordlessEnabled: true }));

    const result = await service.removeCredential(
      "user-1",
      "cred-1",
      CURRENT_PASSWORD,
    );

    expect(result.passwordlessDisabled).toBe(true);
    expect(users.get("user-1")?.passwordlessEnabled).toBe(false);
  });

  it("leaves passwordless untouched when other credentials remain", async () => {
    const { service, credentials, users } = makeService();
    credentials.set("cred-1", makeCredential({ id: "cred-1" }));
    credentials.set(
      "cred-2",
      makeCredential({ id: "cred-2", credentialId: "credential-id-2" }),
    );
    users.set("user-1", makeUser({ passwordlessEnabled: true }));

    const result = await service.removeCredential(
      "user-1",
      "cred-1",
      CURRENT_PASSWORD,
    );

    expect(result.passwordlessDisabled).toBe(false);
    expect(users.get("user-1")?.passwordlessEnabled).toBe(true);
  });
});

describe("WebauthnService.setPasswordless", () => {
  it("refuses to enable passwordless with zero credentials", async () => {
    const { service } = makeService();

    await expect(
      service.setPasswordless("user-1", true, CURRENT_PASSWORD),
    ).rejects.toThrow();
  });

  it("enables passwordless once a credential exists", async () => {
    const { service, credentials, users } = makeService();
    credentials.set("cred-1", makeCredential());

    await service.setPasswordless("user-1", true, CURRENT_PASSWORD);

    expect(users.get("user-1")?.passwordlessEnabled).toBe(true);
  });
});
