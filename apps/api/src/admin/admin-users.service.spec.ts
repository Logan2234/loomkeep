import { vi } from "vitest";
import type { EventsGateway } from "../events/events.gateway";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminUsersService } from "./admin-users.service";

const NOW = new Date("2026-11-22T12:00:00.000Z");

function makeService(user: Record<string, unknown> | null) {
  const list = () => ({ findMany: vi.fn().mockResolvedValue([]) });
  const entries = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    groupBy: vi.fn().mockResolvedValue([]),
  });
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(user) },
    userEntitlement: list(),
    libraryEntry: entries(),
    gameEntry: entries(),
    bookEntry: entries(),
    musicEntry: entries(),
    mfaRecoveryCode: { count: vi.fn().mockResolvedValue(7) },
    apiKey: list(),
    userDevice: list(),
    pushSubscription: list(),
    securityEvent: list(),
    importRun: list(),
    userAchievement: { count: vi.fn().mockResolvedValue(31) },
    listMember: { count: vi.fn().mockResolvedValue(2) },
    savedView: { count: vi.fn().mockResolvedValue(4) },
    moderationDecision: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "d1",
          measure: "WARNING",
          tosClause: "§6.2",
          decidedAt: new Date("2026-09-03T10:00:00.000Z"),
          decidedBy: null,
        },
      ]),
    },
    report: { count: vi.fn().mockResolvedValue(1) },
    block: { count: vi.fn().mockResolvedValue(0) },
  } as unknown as PrismaService;
  const events = {
    connectedUserIds: vi.fn().mockResolvedValue(new Set()),
  } as unknown as EventsGateway;
  return new AdminUsersService(prisma, events);
}

const USER = {
  id: "u1",
  email: "camille@example.com",
  username: "camille",
  displayName: "Camille",
  emailVerified: true,
  role: "USER",
  createdAt: new Date("2026-03-14T00:00:00.000Z"),
  lastActiveAt: null,
  inactivityWarningSentAt: null,
  enabledDomains: ["MEDIA", "BOOKS"],
  onboardedAt: null,
  mfaTotpEnabled: true,
  mfaEmailEnabled: false,
  passwordlessEnabled: true,
  _count: { webauthnCredentials: 2 },
  birthDate: new Date("1996-05-20T00:00:00.000Z"),
  acquisitionSource: "FRIEND",
  acquisitionSourceOther: null,
  acceptedTermsVersion: "2026-09",
  acceptedTermsAt: new Date("2026-03-14T00:00:00.000Z"),
  locale: "fr",
  timezone: "Europe/Paris",
  watchRegion: "FR",
  watchProviderIds: [8, 337],
  notifyEmail: "WEEKLY",
  notifyPush: "DAILY",
  notifyNewsletter: false,
  newsletterOptInAt: null,
  profileAccess: "FRIENDS",
  defaultReviewVisibility: "FRIENDS",
  allowAdultContent: false,
};

describe("AdminUsersService.detail", () => {
  it("gives an age bracket, never the birth date", async () => {
    const detail = await makeService(USER).detail("u1", NOW);

    expect(detail.journey.ageBracket).toBe("25-34");
    expect(JSON.stringify(detail)).not.toContain("1996");
  });

  it("gathers the security, preference, engagement and moderation facts", async () => {
    const detail = await makeService(USER).detail("u1", NOW);

    expect(detail.user.secondFactors).toEqual(["TOTP", "WEBAUTHN"]);
    expect(detail.security).toMatchObject({
      passkeys: 2,
      passwordless: true,
      recoveryCodesLeft: 7,
    });
    expect(detail.preferences).toMatchObject({
      watchRegion: "FR",
      watchProviderCount: 2,
      notifyPush: "DAILY",
    });
    expect(detail.engagement).toEqual({
      achievements: 31,
      sharedListMemberships: 2,
      savedViews: 4,
    });
    expect(detail.moderation).toEqual({
      decisions: [
        {
          id: "d1",
          measure: "WARNING",
          tosClause: "§6.2",
          decidedAt: "2026-09-03T10:00:00.000Z",
          decidedByName: null,
        },
      ],
      reportsFiled: 1,
      blocking: 0,
      blockedBy: 0,
    });
  });

  it("answers 404 for an unknown account", async () => {
    await expect(makeService(null).detail("nope", NOW)).rejects.toMatchObject({
      code: "admin.account_not_found",
    });
  });
});
