import { formatHours } from "$lib/format";
import { m } from "$lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import GameTimeToBeat from "./GameTimeToBeat.svelte";

const HOLLOW_KNIGHT = {
  hastilyMin: 1560,
  normallyMin: 2460,
  completelyMin: 3600,
  submissions: 152,
};

describe("GameTimeToBeat", () => {
  it("lists the three estimates with the player count and a link to IGDB", () => {
    render(GameTimeToBeat, {
      props: {
        timeToBeat: HOLLOW_KNIGHT,
        sourceUrl: "https://www.igdb.com/games/hollow-knight",
      },
    });

    expect(screen.getByText(m.game_time_to_beat_hastily())).toBeTruthy();
    expect(screen.getByText(formatHours(2460))).toBeTruthy();
    expect(screen.getByText(m.game_time_to_beat_completely())).toBeTruthy();
    expect(
      screen.getByText(m.game_time_to_beat_source({ count: 152 }), {
        exact: false,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "IGDB" }).getAttribute("href"),
    ).toBe("https://www.igdb.com/games/hollow-knight");
  });

  it("leaves out an estimate IGDB doesn't have, and the link without a page", () => {
    render(GameTimeToBeat, {
      props: {
        timeToBeat: { ...HOLLOW_KNIGHT, completelyMin: null },
        sourceUrl: null,
      },
    });

    expect(screen.queryByText(m.game_time_to_beat_completely())).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
