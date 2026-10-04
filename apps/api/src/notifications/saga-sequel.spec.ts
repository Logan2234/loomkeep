import { vi } from "vitest";
import { NotificationService } from "./notification.service";

const DUNE_3 = {
  id: "sm-3",
  sagaKey: "TMDB:726871",
  source: "TMDB",
  sourceId: "1170608",
  type: "MOVIE",
  title: "Dune: Part Three",
  isAdult: false,
  saga: { title: "Dune Collection" },
};

function makeService({
  announced = [DUNE_3] as unknown[],
  recipients = [] as unknown[],
} = {}) {
  const prisma = {
    sagaMember: {
      findMany: vi.fn().mockResolvedValue(announced),
      update: vi.fn().mockResolvedValue({}),
    },
    libraryEntry: {
      findMany: vi.fn((args: { where: Record<string, unknown> }) =>
        Promise.resolve(args.where.finishedAt ? recipients : []),
      ),
    },
    episode: { findMany: vi.fn().mockResolvedValue([]) },
    notification: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        locale: "fr",
        alertPrefs: {},
        suspendedUntil: null,
      }),
    },
  };
  const push = { sendToUser: vi.fn().mockResolvedValue(undefined) };
  const mail = { sendSagaSequel: vi.fn().mockResolvedValue(undefined) };
  const service = new NotificationService(
    prisma as never,
    { record: (_key: string, fn: () => Promise<unknown>) => fn() } as never,
    { emitToUser: vi.fn() } as never,
    push as never,
    mail as never,
  );
  return { service, prisma, push, mail };
}

const fan = (id: string, alertPrefs: object = {}) => ({
  user: {
    id,
    email: `${id}@example.com`,
    locale: "fr",
    alertPrefs,
    suspendedUntil: null,
  },
});

describe("NotificationService · sequel announcements", () => {
  it("rings and pushes everyone who finished part of the saga, once", async () => {
    const { service, prisma, push, mail } = makeService({
      recipients: [fan("u1")],
    });

    await service.scanAll();

    expect(prisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            userId: "u1",
            type: "SAGA_SEQUEL_ANNOUNCED",
            title: "Dune: Part Three",
            url: "/app/media/movie/1170608",
            dedupeKey: "saga-sequel:TMDB:726871:1170608",
          }),
        ],
      }),
    );
    expect(push.sendToUser).toHaveBeenCalledOnce();
    // Email is off by default for this alert.
    expect(mail.sendSagaSequel).not.toHaveBeenCalled();
    expect(prisma.sagaMember.update).toHaveBeenCalledWith({
      where: { id: "sm-3" },
      data: { notifiedAt: expect.any(Date) },
    });
  });

  it("emails those who switched the email on", async () => {
    const { service, mail } = makeService({
      recipients: [fan("u1", { SAGA_SEQUEL_ANNOUNCED: { email: true } })],
    });

    await service.scanAll();

    expect(mail.sendSagaSequel).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1" }),
      "Dune: Part Three",
      "Dune Collection",
      "/app/media/movie/1170608",
    );
  });

  it("only asks for finishers who don't already track the new work", async () => {
    const { service, prisma } = makeService();

    await service.scanAll();

    const query = prisma.libraryEntry.findMany.mock.calls
      .map(([args]) => args.where)
      .find((where) => where.finishedAt);
    expect(query).toMatchObject({
      finishedAt: { not: null },
      mediaItem: { sagaKey: "TMDB:726871" },
      user: {
        entries: {
          none: {
            mediaItem: {
              externalIds: {
                some: { source: "TMDB", type: "MOVIE", externalId: "1170608" },
              },
            },
          },
        },
      },
    });
  });
});
