import { vi, type Mock } from "vitest";
import type { JobRunService } from "../jobs/job-run.service";
import type { MailService } from "../mail/mail.service";
import type { PrismaService } from "../prisma/prisma.service";
import {
  isPausedReminderDue,
  PausedReminderService,
} from "./paused-reminder.service";
import type { PushService } from "./push.service";

const DAY_MS = 24 * 60 * 60 * 1000;
// Monday 2 November 2026, 9:00 in Paris (UTC+1 in winter).
const FIRST_MONDAY_9H_PARIS = new Date("2026-11-02T08:00:00Z");

function make(
  rows: { series?: unknown[]; books?: unknown[]; games?: unknown[] } = {},
) {
  const prisma = {
    user: { findMany: vi.fn().mockResolvedValue([]) },
    libraryEntry: { findMany: vi.fn().mockResolvedValue(rows.series ?? []) },
    bookEntry: { findMany: vi.fn().mockResolvedValue(rows.books ?? []) },
    gameEntry: { findMany: vi.fn().mockResolvedValue(rows.games ?? []) },
    episode: { count: vi.fn().mockResolvedValue(4) },
  } as unknown as PrismaService;
  const mail = { sendPausedReminder: vi.fn() } as unknown as MailService;
  const push = { sendToUser: vi.fn() } as unknown as PushService;
  const service = new PausedReminderService(
    prisma,
    mail,
    push,
    {} as JobRunService,
  );
  return { service, prisma, mail, push };
}

const daysAgo = (days: number) =>
  new Date(FIRST_MONDAY_9H_PARIS.getTime() - days * DAY_MS);

const SERIES = {
  mediaItemId: "media-1",
  watchedEpisodes: 8,
  lastWatchedAt: daysAgo(36),
  mediaItem: {
    title: "Severance",
    type: "SERIES",
    episodeCount: 10,
    canonicalSource: "TMDB",
    externalIds: [{ source: "TMDB", externalId: "95396" }],
  },
};
const BOOK = {
  currentPage: 100,
  sessions: [{ occurredAt: daysAgo(64) }],
  bookItem: {
    title: "Dune",
    pageCount: 400,
    canonicalSource: "OPEN_LIBRARY",
    externalIds: [{ source: "OPEN_LIBRARY", externalId: "OL893415W" }],
  },
};

describe("isPausedReminderDue", () => {
  it("fires on the first Monday of the month at 9h local", () => {
    expect(isPausedReminderDue("Europe/Paris", FIRST_MONDAY_9H_PARIS)).toBe(
      true,
    );
  });

  it("skips the other Mondays and the other hours", () => {
    const secondMonday = new Date("2026-11-09T08:00:00Z");
    const tenOClock = new Date("2026-11-02T09:00:00Z");
    expect(isPausedReminderDue("Europe/Paris", secondMonday)).toBe(false);
    expect(isPausedReminderDue("Europe/Paris", tenOClock)).toBe(false);
  });
});

describe("PausedReminderService.pausedWorks", () => {
  it("asks for 30 to 180 days without activity, in every domain", async () => {
    const { service, prisma } = make();

    await service.pausedWorks("user-1", FIRST_MONDAY_9H_PARIS);

    const [[seriesQuery]] = (prisma.libraryEntry.findMany as Mock).mock.calls;
    const window = seriesQuery.where.lastWatchedAt;
    expect(Math.round((+FIRST_MONDAY_9H_PARIS - window.lt) / DAY_MS)).toBe(30);
    expect(Math.round((+FIRST_MONDAY_9H_PARIS - window.gt) / DAY_MS)).toBe(180);
    const [[bookQuery]] = (prisma.bookEntry.findMany as Mock).mock.calls;
    expect(bookQuery.where.sessions.none.occurredAt.gte).toEqual(window.lt);
  });

  it("puts the work nearest its end first, with what came out since", async () => {
    const { service } = make({ series: [SERIES], books: [BOOK] });

    const works = await service.pausedWorks("user-1", FIRST_MONDAY_9H_PARIS);

    expect(works.map((w) => w.title)).toEqual(["Severance", "Dune"]);
    expect(works[0]).toMatchObject({
      url: "/app/media/series/95396",
      episodesLeft: 2,
      pausedDays: 36,
      releasedSince: 4,
    });
    expect(works[1]).toMatchObject({
      url: "/app/books/OL893415W",
      pagesLeft: 300,
      releasedSince: 0,
    });
  });
});

describe("PausedReminderService.run", () => {
  it("sends on the channels the account turned on, and only then", async () => {
    const { service, prisma, mail, push } = make({ series: [SERIES] });
    (prisma.user.findMany as Mock).mockResolvedValue([
      {
        id: "user-1",
        email: "alice@example.com",
        locale: "fr",
        timezone: "Europe/Paris",
        alertPrefs: { PAUSED_REMINDER: { push: true } },
      },
    ]);

    await expect(service.run(FIRST_MONDAY_9H_PARIS)).resolves.toBe(1);

    expect(mail.sendPausedReminder).not.toHaveBeenCalled();
    const [[userId, payload]] = (push.sendToUser as Mock).mock.calls;
    expect(userId).toBe("user-1");
    expect(payload.url).toBe("/app/media/series/95396");
    expect(payload.body).toContain("Severance");
  });

  it("sends nothing when nothing is on pause", async () => {
    const { service, prisma, mail, push } = make();
    (prisma.user.findMany as Mock).mockResolvedValue([
      {
        id: "user-1",
        email: "alice@example.com",
        locale: "fr",
        timezone: "Europe/Paris",
        alertPrefs: { PAUSED_REMINDER: { email: true, push: true } },
      },
    ]);

    await expect(service.run(FIRST_MONDAY_9H_PARIS)).resolves.toBe(0);
    expect(mail.sendPausedReminder).not.toHaveBeenCalled();
    expect(push.sendToUser).not.toHaveBeenCalled();
  });
});
