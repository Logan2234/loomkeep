import { Domain } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import {
  defaultPhoneLayout,
  PHONE_WIDGET_TYPES,
  phoneWidgetSize,
  resolvePhoneLayout,
} from "./phone-layout";
import type { HomeGate } from "./widgets";

const gate = (domains: Domain[]): HomeGate => ({
  isDomainEnabled: (d) => domains.includes(d),
  socialEnabled: true,
  gamificationEnabled: true,
  isAdmin: false,
});
const ALL = [Domain.MEDIA, Domain.GAMES, Domain.BOOKS, Domain.MUSIC];
const types = (widgets: { type: string }[]) => widgets.map((w) => w.type);

describe("defaultPhoneLayout", () => {
  it("opens on a shelf per domain, then the week's releases", () => {
    expect(types(defaultPhoneLayout(gate(ALL)))).toEqual([
      "toWatch",
      "gamesPlaying",
      "booksReading",
      "musicToListen",
      "thisWeek",
    ]);
  });

  it("leaves out the shelves of domains turned off", () => {
    expect(types(defaultPhoneLayout(gate([Domain.BOOKS])))).toEqual([
      "booksReading",
    ]);
  });
});

describe("resolvePhoneLayout", () => {
  it("keeps the stored order, without widgets the phone can't show", () => {
    const stored = {
      widgets: [
        { id: "n", type: "note" as const },
        { id: "v", type: "dividerVertical" as const },
        { id: "g", type: "gamesPlaying" as const },
      ],
    };
    expect(types(resolvePhoneLayout(stored, gate(ALL)))).toEqual([
      "note",
      "gamesPlaying",
    ]);
  });

  it("falls back to the default when nothing stored can show", () => {
    const stored = {
      widgets: [
        { id: "m", type: "musicToListen" as const },
        { id: "d", type: "dividerHorizontal" as const },
      ],
    };
    expect(types(resolvePhoneLayout(stored, gate([Domain.MEDIA])))).toEqual([
      "toWatch",
      "thisWeek",
    ]);
  });
});

it("offers every desktop widget but the vertical divider", () => {
  expect(PHONE_WIDGET_TYPES).not.toContain("dividerVertical");
  expect(PHONE_WIDGET_TYPES).toContain("savedView");
});

it("gives a shelf drawn as rows less height than a poster shelf", () => {
  const posters = phoneWidgetSize({ id: "a", type: "toWatch" }, 360);
  const rows = phoneWidgetSize(
    { id: "a", type: "toWatch", config: { display: "rows" } },
    360,
  );
  expect(rows.height).toBeLessThan(posters.height);
});
