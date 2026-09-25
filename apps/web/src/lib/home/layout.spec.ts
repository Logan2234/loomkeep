import { Domain } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { defaultHomeLayout, hiddenWidgets, resolveHomeLayout } from "./layout";
import type { HomeGate } from "./widgets";

const gate = (domains: Domain[], socialEnabled = true): HomeGate => ({
  isDomainEnabled: (d) => domains.includes(d),
  socialEnabled,
  gamificationEnabled: false,
  isAdmin: false,
});
const ALL = [Domain.MEDIA, Domain.GAMES, Domain.BOOKS, Domain.MUSIC];
const place = (widgets: { type: string; x: number; y: number; w: number }[]) =>
  Object.fromEntries(widgets.map(({ type, x, y, w }) => [type, { x, y, w }]));

describe("defaultHomeLayout", () => {
  it("keeps the old home's main column and sidebar", () => {
    expect(place(defaultHomeLayout(gate(ALL)))).toEqual({
      toWatch: { x: 0, y: 0, w: 9 },
      gamesPlaying: { x: 0, y: 6, w: 6 },
      booksReading: { x: 6, y: 6, w: 3 },
      musicToListen: { x: 0, y: 11, w: 3 },
      resume: { x: 3, y: 11, w: 6 },
      activity: { x: 0, y: 16, w: 9 },
      thisWeek: { x: 9, y: 0, w: 3 },
      readingGoal: { x: 9, y: 5, w: 3 },
      quickLinks: { x: 9, y: 8, w: 3 },
    });
  });

  it("lets the widgets of a row fill the space a disabled domain leaves", () => {
    const layout = place(defaultHomeLayout(gate([Domain.GAMES])));

    expect(layout.gamesPlaying).toEqual({ x: 0, y: 0, w: 9 });
    expect(layout.booksReading).toBeUndefined();
  });

  it("lines the sidebar up across the page when the main column is empty", () => {
    const layout = place(defaultHomeLayout(gate([Domain.PODCASTS], false)));

    expect(layout).toEqual({ quickLinks: { x: 0, y: 0, w: 4 } });
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
