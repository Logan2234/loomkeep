import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { vi } from "vitest";
import { CalendarFeedController } from "./calendar-feed.controller";
import type { CalendarFeedService } from "./calendar-feed.service";

/**
 * `calendar.ics` is the one route here that is not a pass-through: it is
 * `@Public()` so a calendar client can poll it by URL, which makes the token
 * the only thing standing between a stranger and someone's watchlist.
 */
function fakeReply() {
  const headers: Record<string, string> = {};
  const reply = {
    header: vi.fn((name: string, value: string) => {
      headers[name] = value;
      return reply;
    }),
    send: vi.fn(),
  } as unknown as FastifyReply & {
    header: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
  return { reply, headers };
}

function makeController(getCalendarIcs = vi.fn(), getReleasesFeed = vi.fn()) {
  const service = {
    getCalendarIcs,
    getReleasesFeed,
  } as unknown as CalendarFeedService;
  return {
    controller: new CalendarFeedController(service),
    getCalendarIcs,
    getReleasesFeed,
  };
}

describe("CalendarFeedController.getCalendarIcs", () => {
  it("serves the calendar as an ICS attachment", async () => {
    const { reply, headers } = fakeReply();
    const { controller } = makeController(
      vi.fn().mockResolvedValue("BEGIN:VCALENDAR"),
    );

    await controller.getCalendarIcs("a-valid-token", reply);

    expect(headers["Content-Type"]).toBe("text/calendar; charset=utf-8");
    expect(headers["Content-Disposition"]).toContain("loomkeep.ics");
    expect(reply.send).toHaveBeenCalledWith("BEGIN:VCALENDAR");
  });

  it("answers 404 without a token, rather than asking the service", async () => {
    // A missing token is indistinguishable from a wrong one on purpose: the
    // route must not confirm that a calendar exists.
    const { reply } = fakeReply();
    const { controller, getCalendarIcs } = makeController();

    await expect(
      controller.getCalendarIcs(undefined, reply),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      code: ErrorCode.LibraryCalendarUnavailable,
    });
    expect(getCalendarIcs).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it("answers 404 for a token the service does not recognise", async () => {
    const { reply } = fakeReply();
    const { controller } = makeController(vi.fn().mockResolvedValue(null));

    await expect(
      controller.getCalendarIcs("stale-token", reply),
    ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    expect(reply.send).not.toHaveBeenCalled();
  });
});

describe("CalendarFeedController releases feed", () => {
  const feed = {
    id: "urn:loomkeep:releases:user-1",
    title: "Loomkeep",
    description: "New episodes",
    link: "https://loomkeep.app/app/calendar",
    entries: [],
  };

  it("serves the same feed as Atom and as RSS", async () => {
    const atom = fakeReply();
    const rss = fakeReply();
    const { controller } = makeController(
      vi.fn(),
      vi.fn().mockResolvedValue(feed),
    );

    await controller.getReleasesAtom("a-valid-token", atom.reply);
    await controller.getReleasesRss("a-valid-token", rss.reply);

    expect(atom.headers["Content-Type"]).toBe(
      "application/atom+xml; charset=utf-8",
    );
    expect(atom.reply.send.mock.calls[0][0]).toContain(
      '<feed xmlns="http://www.w3.org/2005/Atom">',
    );
    expect(rss.headers["Content-Type"]).toBe(
      "application/rss+xml; charset=utf-8",
    );
    expect(rss.reply.send.mock.calls[0][0]).toContain('<rss version="2.0">');
  });

  it("answers 404 for a missing or unknown token", async () => {
    const { reply } = fakeReply();
    const { controller, getReleasesFeed } = makeController(
      vi.fn(),
      vi.fn().mockResolvedValue(null),
    );

    await expect(
      controller.getReleasesAtom(undefined, reply),
    ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    expect(getReleasesFeed).not.toHaveBeenCalled();

    await expect(
      controller.getReleasesRss("stale-token", reply),
    ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    expect(reply.send).not.toHaveBeenCalled();
  });
});
