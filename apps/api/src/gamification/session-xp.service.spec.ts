import { XpReason } from "@loomkeep/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionXpService } from "./session-xp.service";

describe("SessionXpService", () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    gameSession: { findMany: vi.fn() },
    bookSession: { findMany: vi.fn() },
  };
  const xp = {
    award: vi.fn(),
    revokeBySource: vi.fn(),
  };
  let service: SessionXpService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ timezone: "UTC" });
    xp.award.mockResolvedValue(true);
    prisma.gameSession.findMany.mockResolvedValue([]);
    prisma.bookSession.findMany.mockResolvedValue([]);
    service = new SessionXpService(prisma as never, xp as never);
  });

  it("shares one user-scoped XP source across game and book sessions for the day", async () => {
    const awarded = await service.awardForToday(
      "user-1",
      new Date("2026-09-26T14:00:00.000Z"),
    );

    expect(awarded).toBe(true);
    expect(xp.award).toHaveBeenCalledWith(
      "user-1",
      XpReason.SESSION_DAY_LOGGED,
      "user-1:2026-09-26",
    );
  });

  it("revokes only that user's day when their final session is deleted", async () => {
    await service.refreshAfterDelete(
      "user-1",
      new Date("2026-09-26T14:00:00.000Z"),
    );

    expect(xp.revokeBySource).toHaveBeenCalledWith("SESSION_DAY", [
      "user-1:2026-09-26",
    ]);
  });

  it("keeps the XP block while another session remains that day", async () => {
    prisma.bookSession.findMany.mockResolvedValue([
      { createdAt: new Date("2026-09-26T18:00:00.000Z") },
    ]);

    await service.refreshAfterDelete(
      "user-1",
      new Date("2026-09-26T14:00:00.000Z"),
    );

    expect(xp.revokeBySource).not.toHaveBeenCalled();
  });
});
