import { vi } from "vitest";
import { NotificationService } from "./notification.service";

const today = new Date().toISOString().slice(0, 10);

const tracked = (
  releaseDatePrecision: string,
  releaseReminderAt = new Date("2026-01-01T00:00:00.000Z"),
) => ({
  userId: "u1",
  gameItemId: "g1",
  releaseReminderAt,
  user: { locale: "fr" },
  gameItem: {
    title: "Kingdom Hearts IV",
    canonicalSource: "IGDB",
    externalIds: [{ source: "IGDB", externalId: "113112" }],
    releaseDate: new Date(`${today}T00:00:00.000Z`),
    releaseDatePrecision,
  },
});

function makeService(games: unknown[]) {
  const prisma = {
    libraryEntry: { findMany: vi.fn().mockResolvedValue([]) },
    gameEntry: { findMany: vi.fn().mockResolvedValue(games) },
    sagaMember: { findMany: vi.fn().mockResolvedValue([]) },
    episode: { findMany: vi.fn().mockResolvedValue([]) },
    notification: {
      createMany: vi.fn(({ data }: { data: unknown[] }) =>
        Promise.resolve({ count: data.length }),
      ),
    },
  };
  const service = new NotificationService(
    prisma as never,
    { record: (_key: string, fn: () => Promise<unknown>) => fn() } as never,
    { emitToUser: vi.fn() } as never,
    { sendToUser: vi.fn() } as never,
    {} as never,
  );
  return { service, prisma };
}

describe("NotificationService · game releases", () => {
  it("tells the players who asked, on the release day", async () => {
    const { service, prisma } = makeService([tracked("DAY")]);

    await service.scanAll();

    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "u1",
          type: "NEW_GAME",
          title: "Kingdom Hearts IV",
          body: "Sortie du jeu",
          url: "/app/games/113112",
          dedupeKey: "game:g1",
        }),
      ],
      skipDuplicates: true,
    });
  });

  it("tells them on the 1st for a game dated to a month", async () => {
    const { service, prisma } = makeService([tracked("MONTH")]);

    await service.scanAll();

    expect(prisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ body: "Sortie prévue ce mois-ci" })],
      }),
    );
  });

  it("stays quiet for a release dated before the reminder was set", async () => {
    const { service, prisma } = makeService([
      tracked(
        "DAY",
        new Date(`${today}T00:00:00.000Z`.replace(today, "2999-01-01")),
      ),
    ]);

    await service.scanAll();

    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});
