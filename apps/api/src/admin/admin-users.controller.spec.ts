import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { AuthService } from "../auth/auth.service";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import type { CommentService } from "../comments/comment.service";
import type { EntitlementService } from "../entitlements/entitlement.service";
import type { ListService } from "../lists/list.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { ModerationReasonBody } from "../reports/dto/moderation-reason.dto";
import type { ModerationDecisionService } from "../reports/moderation-decision.service";
import type { ReportService } from "../reports/report.service";
import type { ReviewService } from "../reviews/review.service";
import type { SecurityEventService } from "../security/security-event.service";
import type { FollowService } from "../social/follow.service";
import type { DataExportService } from "../users/data-export.service";
import { AdminUsersController } from "./admin-users.controller";

function jwtPayload(sub: string): JwtPayload {
  return { sub, email: `${sub}@example.com` };
}

const REASON_BODY: ModerationReasonBody = {
  reasonText: "Comptes multiples créés pour contourner une sanction.",
  legalBasis: "TOS_BREACH",
  tosClause: "§10 — Manipulation et abus du service",
};

function makeController() {
  const prisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    userEntitlement: { findMany: jest.fn().mockResolvedValue([]) },
    libraryEntry: { count: jest.fn() },
    gameEntry: { count: jest.fn() },
    bookEntry: { count: jest.fn() },
    musicEntry: { count: jest.fn() },
  } as unknown as PrismaService;
  const authService = {
    resendVerificationEmail: jest.fn(),
    requestPasswordReset: jest.fn(),
  } as unknown as AuthService;
  const dataExport = {
    buildExport: jest.fn(),
  } as unknown as DataExportService;
  const securityEvents = {
    record: jest.fn(),
  } as unknown as SecurityEventService;
  const reviews = { listMine: jest.fn() } as unknown as ReviewService;
  const comments = { listByAuthor: jest.fn() } as unknown as CommentService;
  const follows = {
    listFollowers: jest.fn(),
    listFollowing: jest.fn(),
  } as unknown as FollowService;
  const reports = { listAgainstUser: jest.fn() } as unknown as ReportService;
  const lists = {
    listEditable: jest.fn(),
  } as unknown as ListService;
  const moderationDecisions = {
    record: jest.fn(),
  } as unknown as ModerationDecisionService;
  const entitlements = {
    setPlan: jest.fn().mockResolvedValue({ plan: "PREMIUM" }),
  } as unknown as EntitlementService;

  const controller = new AdminUsersController(
    prisma,
    authService,
    dataExport,
    securityEvents,
    reviews,
    comments,
    follows,
    reports,
    lists,
    moderationDecisions,
    entitlements,
  );
  return {
    controller,
    prisma,
    authService,
    dataExport,
    securityEvents,
    moderationDecisions,
    entitlements,
  };
}

describe("AdminUsersController.listUsers", () => {
  it("maps each account's persisted lastActiveAt/inactivityWarningSentAt", async () => {
    const { controller, prisma } = makeController();
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: "user-1",
        email: "a@example.com",
        username: "a",
        displayName: "A",
        emailVerified: true,
        role: "USER",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        lastActiveAt: new Date("2026-02-01T00:00:00.000Z"),
        inactivityWarningSentAt: new Date("2026-02-15T00:00:00.000Z"),
      },
      {
        id: "user-2",
        email: "b@example.com",
        username: "b",
        displayName: "B",
        emailVerified: false,
        role: "USER",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        lastActiveAt: null,
        inactivityWarningSentAt: null,
      },
    ]);

    const result = await controller.listUsers();

    expect(result.page).toBe(1);
    expect(result.users[0].lastActiveAt).toBe("2026-02-01T00:00:00.000Z");
    expect(result.users[0].inactivityWarningSentAt).toBe(
      "2026-02-15T00:00:00.000Z",
    );
    expect(result.users[1].lastActiveAt).toBeNull();
    expect(result.users[1].inactivityWarningSentAt).toBeNull();
  });

  it("paginates with skip/take derived from the page query param", async () => {
    const { controller, prisma } = makeController();
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    await controller.listUsers(undefined, undefined, "3");

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 100, take: 50 }),
    );
  });

  it("applies the search/filter query params to the where clause", async () => {
    const { controller, prisma } = makeController();
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    await controller.listUsers("alice", "unverified");

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { email: { contains: "alice", mode: "insensitive" } },
            { username: { contains: "alice", mode: "insensitive" } },
            { displayName: { contains: "alice", mode: "insensitive" } },
          ],
          emailVerified: false,
        },
      }),
    );
  });
});

describe("AdminUsersController.getUserLibraryStats", () => {
  it("counts every persisted library domain, splitting media by type", async () => {
    const { controller, prisma } = makeController();
    (prisma.libraryEntry.count as jest.Mock)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2);
    (prisma.gameEntry.count as jest.Mock).mockResolvedValue(4);
    (prisma.bookEntry.count as jest.Mock).mockResolvedValue(6);
    (prisma.musicEntry.count as jest.Mock).mockResolvedValue(1);

    await expect(controller.getUserLibraryStats("user-2")).resolves.toEqual({
      movies: 3,
      series: 5,
      anime: 2,
      games: 4,
      books: 6,
      music: 1,
      total: 21,
    });

    expect(prisma.libraryEntry.count).toHaveBeenCalledWith({
      where: { userId: "user-2", mediaItem: { type: "MOVIE" } },
    });
    expect(prisma.libraryEntry.count).toHaveBeenCalledWith({
      where: { userId: "user-2", mediaItem: { type: "SERIES" } },
    });
    expect(prisma.libraryEntry.count).toHaveBeenCalledWith({
      where: { userId: "user-2", mediaItem: { type: "ANIME" } },
    });
  });
});

describe("AdminUsersController.updateUserRole", () => {
  it("rejects an admin demoting themselves", async () => {
    const { controller } = makeController();

    await expect(
      controller.updateUserRole(
        "user-1",
        { role: "USER" },
        jwtPayload("user-1"),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("allows an admin granting/revoking another account's role", async () => {
    const { controller, prisma } = makeController();
    (prisma.user.update as jest.Mock).mockResolvedValue({
      role: "ADMIN",
    });

    const result = await controller.updateUserRole(
      "user-2",
      { role: "ADMIN" },
      jwtPayload("user-1"),
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: { role: "ADMIN" },
    });
    expect(result).toEqual({ role: "ADMIN" });
  });

  it("allows an admin keeping their own ADMIN role", async () => {
    const { controller, prisma } = makeController();
    (prisma.user.update as jest.Mock).mockResolvedValue({
      role: "ADMIN",
    });

    await expect(
      controller.updateUserRole(
        "user-1",
        { role: "ADMIN" },
        jwtPayload("user-1"),
      ),
    ).resolves.toEqual({ role: "ADMIN" });
  });
});

describe("AdminUsersController.updateUserPlan", () => {
  it("delegates to EntitlementService.setPlan and returns the resulting plan", async () => {
    const { controller, entitlements } = makeController();

    const result = await controller.updateUserPlan("user-2", {
      plan: "PREMIUM",
    });

    expect(entitlements.setPlan).toHaveBeenCalledWith("user-2", "PREMIUM");
    expect(result).toEqual({ plan: "PREMIUM" });
  });
});

describe("AdminUsersController.getUserExport", () => {
  it("delegates to DataExportService for the target account", async () => {
    const { controller, dataExport } = makeController();
    (dataExport.buildExport as jest.Mock).mockResolvedValue({
      exportedAt: "now",
    });

    const result = await controller.getUserExport("user-2");

    expect(dataExport.buildExport).toHaveBeenCalledWith("user-2");
    expect(result).toEqual({ exportedAt: "now" });
  });
});

describe("AdminUsersController.resendVerification", () => {
  it("delegates to AuthService for the target account", async () => {
    const { controller, authService } = makeController();

    await controller.resendVerification("user-2");

    expect(authService.resendVerificationEmail).toHaveBeenCalledWith("user-2");
  });
});

describe("AdminUsersController.sendPasswordResetLink", () => {
  it("throws NotFoundException when no account matches", async () => {
    const { controller, prisma } = makeController();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(controller.sendPasswordResetLink("nobody")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("requests a reset for the target account's email", async () => {
    const { controller, prisma, authService } = makeController();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      email: "alice@example.com",
    });

    await controller.sendPasswordResetLink("user-2");

    expect(authService.requestPasswordReset).toHaveBeenCalledWith(
      "alice@example.com",
    );
  });
});

describe("AdminUsersController.deleteUser", () => {
  it("rejects an admin deleting their own account", async () => {
    const { controller } = makeController();

    await expect(
      controller.deleteUser("user-1", jwtPayload("user-1"), REASON_BODY),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws NotFoundException when no account matches", async () => {
    const { controller, prisma } = makeController();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      controller.deleteUser("nobody", jwtPayload("user-1"), REASON_BODY),
    ).rejects.toThrow(NotFoundException);
  });

  it("records USER_DELETED and the DSA art. 17 moderation decision before deleting the account", async () => {
    const { controller, prisma, securityEvents, moderationDecisions } =
      makeController();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-2",
      email: "bob@example.com",
      username: "bob",
    });

    await controller.deleteUser("user-2", jwtPayload("user-1"), REASON_BODY);

    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "USER_DELETED",
        userId: "user-2",
      }),
    );
    expect(moderationDecisions.record).toHaveBeenCalledWith(
      expect.objectContaining({
        measure: "ACCOUNT_DELETED",
        targetType: "USER",
        targetId: "user-2",
        subjectUserId: "user-2",
        subjectEmail: "bob@example.com",
        subjectUsername: "bob",
        reasonText: REASON_BODY.reasonText,
        decidedById: "user-1",
      }),
    );
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: "user-2" },
    });
  });
});
