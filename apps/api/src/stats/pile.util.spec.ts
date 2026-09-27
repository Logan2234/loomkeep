import { bookPileItem, gamePileItem, summarizePile } from "./pile.util";

describe("summarizePile", () => {
  it("sums what it can count and says how much of the pile that covers", () => {
    expect(
      summarizePile("PAGES", [
        { amount: 320, estimated: false },
        { amount: null, estimated: false },
        { amount: 180, estimated: false },
      ]),
    ).toEqual({
      unit: "PAGES",
      amount: 500,
      entries: 3,
      counted: 2,
      estimated: false,
    });
  });

  it("flags the total as an estimate as soon as one counted entry is", () => {
    const pile = summarizePile("MINUTES", [
      { amount: 60, estimated: false },
      { amount: 40, estimated: true },
    ]);

    expect(pile.estimated).toBe(true);
  });

  it("ignores an uncounted entry's estimate flag", () => {
    const pile = summarizePile("MINUTES", [
      { amount: 60, estimated: false },
      { amount: null, estimated: true },
    ]);

    expect(pile.estimated).toBe(false);
  });
});

describe("gamePileItem", () => {
  it("counts a backlog game at IGDB's normal playthrough", () => {
    expect(gamePileItem("BACKLOG", 2460, 0).amount).toBe(2460);
  });

  it("counts what the player's own playtime leaves of a game in progress, never below zero", () => {
    expect(gamePileItem("PLAYING", 2460, 600).amount).toBe(1860);
    expect(gamePileItem("PLAYING", 2460, 5000).amount).toBe(0);
  });

  it("leaves a game IGDB has no average for out of the total", () => {
    expect(gamePileItem("BACKLOG", null, 0).amount).toBeNull();
  });
});

describe("bookPileItem", () => {
  it("counts the pages left, and nothing without a page count", () => {
    expect(bookPileItem(320, 120).amount).toBe(200);
    expect(bookPileItem(320, 400).amount).toBe(0);
    expect(bookPileItem(null, 0).amount).toBeNull();
  });
});
