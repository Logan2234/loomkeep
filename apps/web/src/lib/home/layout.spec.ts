import { Domain, type HomeLayoutDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { defaultHomeLayout, hiddenWidgets, resolveHomeLayout } from "./layout";
import { HOME_WIDGETS, type HomeGate } from "./widgets";

const gate = (
  domains: Domain[],
  socialEnabled = true,
  gamificationEnabled = false,
): HomeGate => ({
  isDomainEnabled: (d) => domains.includes(d),
  socialEnabled,
  gamificationEnabled,
  isAdmin: false,
});
const ALL = [Domain.MEDIA, Domain.GAMES, Domain.BOOKS, Domain.MUSIC];
const place = (widgets: { type: string; x: number; y: number; w: number }[]) =>
  Object.fromEntries(widgets.map(({ type, x, y, w }) => [type, { x, y, w }]));

describe("defaultHomeLayout", () => {
  it("puts the search on top, a main column and a sidebar below it", () => {
    expect(place(defaultHomeLayout(gate(ALL, true, true)))).toEqual({
      quickSearch: { x: 0, y: 0, w: 12 },
      toWatch: { x: 0, y: 1, w: 9 },
      gamesPlaying: { x: 0, y: 7, w: 6 },
      booksReading: { x: 6, y: 7, w: 3 },
      musicToListen: { x: 0, y: 12, w: 3 },
      tonightPick: { x: 3, y: 12, w: 3 },
      onThisDay: { x: 6, y: 12, w: 3 },
      activity: { x: 0, y: 17, w: 9 },
      levelStreak: { x: 9, y: 1, w: 3 },
      thisWeek: { x: 9, y: 4, w: 3 },
      readingGoal: { x: 9, y: 9, w: 3 },
      quickLinks: { x: 9, y: 12, w: 3 },
    });
  });

  it("lets the widgets of a row fill the space a disabled domain leaves", () => {
    const layout = place(defaultHomeLayout(gate([Domain.GAMES])));

    expect(layout.gamesPlaying).toEqual({ x: 0, y: 1, w: 9 });
    expect(layout.booksReading).toBeUndefined();
    expect(layout.onThisDay).toEqual({ x: 0, y: 6, w: 9 });
  });

  it("keeps the main column filled with no domain at all", () => {
    expect(place(defaultHomeLayout(gate([], false)))).toEqual({
      quickSearch: { x: 0, y: 0, w: 12 },
      onThisDay: { x: 0, y: 1, w: 9 },
      quickLinks: { x: 9, y: 1, w: 3 },
    });
  });

  it("keeps every widget within its kind's size bounds, whatever is on", () => {
    for (let mask = 0; mask < 1 << ALL.length; mask++) {
      const domains = ALL.filter((_, i) => mask & (1 << i));

      for (const social of [false, true]) {
        for (const gamification of [false, true]) {
          for (const w of defaultHomeLayout(
            gate(domains, social, gamification),
          )) {
            const { min, max } = HOME_WIDGETS[w.type];
            expect(w.w).toBeGreaterThanOrEqual(min.w);
            expect(w.w).toBeLessThanOrEqual(max.w);
          }
        }
      }
    }
  });
});

describe("resolveHomeLayout", () => {
  it("hides a gated-out widget and lets the ones below rise", () => {
    const stored = {
      widgets: [
        { id: "a", type: "gamesPlaying" as const, x: 0, y: 0, w: 6, h: 5 },
        { id: "b", type: "myLists" as const, x: 0, y: 5, w: 6, h: 5 },
      ],
    };

    const out = resolveHomeLayout(stored, gate([Domain.MEDIA]));

    expect(out).toEqual([{ id: "b", type: "myLists", x: 0, y: 0, w: 6, h: 5 }]);
    expect(hiddenWidgets(stored, gate([Domain.MEDIA]))).toEqual([
      stored.widgets[0],
    ]);
  });

  it("drops a kind that no longer exists instead of saving it back", () => {
    const stored = {
      widgets: [
        { id: "a", type: "myLists" as const, x: 0, y: 0, w: 6, h: 5 },
        // Removed since this page was saved: the API would refuse it.
        { id: "b", type: "statsBrief", x: 6, y: 0, w: 6, h: 3 },
      ],
    } as unknown as HomeLayoutDto;

    expect(hiddenWidgets(stored, gate(ALL))).toEqual([]);
  });

  it("pulls a widget back inside its kind's size bounds", () => {
    const out = resolveHomeLayout(
      {
        widgets: [{ id: "g", type: "readingGoal", x: 10, y: 0, w: 12, h: 1 }],
      },
      gate(ALL),
    );

    expect(out[0]).toMatchObject({ x: 9, w: 3, h: 3 });
  });

  it("never shows a widget that isn't shipped yet", () => {
    const out = resolveHomeLayout(
      {
        widgets: [
          { id: "q", type: "quickLinks", x: 0, y: 0, w: 3, h: 4 },
          { id: "s", type: "savedView", x: 3, y: 0, w: 6, h: 5 },
        ],
      },
      gate(ALL),
    );

    expect(out.map((w) => w.id)).toEqual(["q"]);
  });

  it("falls back to the default page when nothing but dividers is left", () => {
    const stored = {
      widgets: [
        {
          id: "d",
          type: "dividerHorizontal" as const,
          x: 0,
          y: 0,
          w: 12,
          h: 1,
        },
        { id: "g", type: "gamesPlaying" as const, x: 0, y: 1, w: 6, h: 5 },
      ],
    };

    const out = resolveHomeLayout(stored, gate([Domain.MEDIA]));

    expect(out.map((w) => w.type)).toContain("toWatch");
    expect(out.map((w) => w.type)).not.toContain("dividerHorizontal");
  });
});
