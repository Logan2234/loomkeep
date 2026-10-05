import { m } from "$lib/paraglide/messages.js";
import {
  xpForLevel,
  type XpHistoryDayDto,
  type XpHistoryItemDto,
} from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import {
  buildTimeline,
  chartBars,
  itemLabel,
  runDescription,
  runLabel,
  type XpRun,
} from "./xp-history";

const item = (over: Partial<XpHistoryItemDto> = {}): XpHistoryItemDto => ({
  reason: "EPISODE_WATCHED",
  revoked: false,
  amount: 10,
  at: "2026-10-05T18:00:00.000Z",
  revokedAt: null,
  earnedAt: null,
  title: "The Bear",
  href: "/app/media/series/136315",
  seasonNumber: null,
  episodeNumber: null,
  achievementKey: null,
  domain: null,
  ...over,
});

const day = (
  date: string,
  items: XpHistoryItemDto[] = [],
  net = items.reduce((sum, i) => sum + i.amount, 0),
): XpHistoryDayDto => ({ day: date, net, items });

const run = (items: XpHistoryItemDto[], over: Partial<XpRun> = {}): XpRun => ({
  kind: "run",
  key: "run",
  reason: "EPISODE_WATCHED",
  revoked: false,
  total: items.reduce((sum, i) => sum + i.amount, 0),
  items,
  ...over,
});

const shape = (days: ReturnType<typeof buildTimeline>) =>
  days[0].segments.map((s) =>
    s.kind === "level" ? `level ${s.level}` : `${s.reason} ×${s.items.length}`,
  );

describe("buildTimeline", () => {
  it("groups consecutive lines of the same reason, not the whole day's", () => {
    const timeline = buildTimeline(
      [
        day("2026-10-05", [
          item(),
          item(),
          item({ reason: "MOVIE_WATCHED", amount: 50 }),
          item(),
        ]),
      ],
      1000,
    );

    expect(shape(timeline)).toEqual([
      "EPISODE_WATCHED ×2",
      "MOVIE_WATCHED ×1",
      "EPISODE_WATCHED ×1",
    ]);
  });

  it("cuts a run where a level was reached, the mark above the line that reached it", () => {
    // Newest first: two episodes after reaching level 12, two before.
    const timeline = buildTimeline(
      [day("2026-10-05", [item(), item(), item(), item()])],
      xpForLevel(12) + 15,
    );

    expect(shape(timeline)).toEqual([
      "EPISODE_WATCHED ×1",
      "level 12",
      "EPISODE_WATCHED ×3",
    ]);
    expect(timeline[0].levelUp).toBe(true);
  });

  it("chains the totals across days to find the level reached on an earlier one", () => {
    const [today, yesterday] = buildTimeline(
      [
        day("2026-10-05", [item({ amount: 100 })]),
        day("2026-10-04", [item({ amount: 200 })]),
      ],
      xpForLevel(12) + 150,
    );

    expect(today.levelUp).toBe(false);
    expect(yesterday.levelUp).toBe(true);
  });

  it("marks a level lost to a line taken back", () => {
    const [today] = buildTimeline(
      [day("2026-10-05", [item({ revoked: true, amount: -40 })])],
      xpForLevel(12) - 10,
    );

    expect(today.segments[0]).toMatchObject({
      kind: "level",
      level: 11,
      up: false,
    });
  });
});

describe("chartBars", () => {
  it("covers the last 14 calendar days, quiet ones at zero, oldest first", () => {
    const bars = chartBars(
      buildTimeline(
        [
          day("2026-10-05", [item({ amount: 30 })]),
          day("2026-10-01", [item({ revoked: true, amount: -10 })]),
        ],
        1000,
      ),
      "2026-10-05",
    );

    expect(bars).toHaveLength(14);
    expect(bars[0].day).toBe("2026-09-22");
    expect(bars.at(-1)).toMatchObject({ day: "2026-10-05", net: 30 });
    expect(bars.find((b) => b.day === "2026-10-01")?.net).toBe(-10);
    expect(bars.find((b) => b.day === "2026-10-03")?.net).toBe(0);
  });
});

describe("labels", () => {
  it("names an episode with its code", () => {
    expect(itemLabel(item({ seasonNumber: 3, episodeNumber: 2 }))).toBe(
      "The Bear · S03E02",
    );
  });

  it("describes a run by its distinct works, the rest counted", () => {
    expect(
      runDescription(
        run([
          item(),
          item({ seasonNumber: 3, episodeNumber: 2 }),
          item({ title: "Severance" }),
          item({ title: "Dune" }),
          item({ title: "Anora" }),
        ]),
      ),
    ).toBe(
      m.gamification_xp_history_others_many({
        titles: "The Bear, Severance",
        count: 2,
      }),
    );
  });

  it("says a revoked run was taken back", () => {
    expect(runLabel(run([item({ amount: -10 })], { revoked: true }))).toBe(
      m.gamification_xp_history_revoked({
        reason: m.gamification_xp_reason_episode_watched().toLowerCase(),
      }),
    );
  });
});
