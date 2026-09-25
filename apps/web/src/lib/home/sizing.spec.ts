import { describe, expect, it } from "vitest";
import { POSTER_ACTION_HEIGHT, posterLayout, rowsLayout } from "./sizing";

const TO_WATCH = { meta: 8, action: true };

describe("posterLayout", () => {
  it("gives the posters every pixel of height the rest leaves", () => {
    const layout = posterLayout({ width: 780, height: 250 }, TO_WATCH);

    expect(layout).toMatchObject({
      mode: "strip",
      showMeta: true,
      showAction: true,
    });
    if (layout.mode !== "strip") throw new Error("strip expected");
    // title 22 + border 2 + track 4 + progress 8 + button 32
    expect(layout.posterHeight).toBe(
      250 - 22 - 2 - 4 - 8 - POSTER_ACTION_HEIGHT,
    );
  });

  it("drops the button, then the progress, as the widget gets shorter", () => {
    const medium = posterLayout({ width: 780, height: 200 }, TO_WATCH);
    const short = posterLayout({ width: 780, height: 140 }, TO_WATCH);

    expect(medium).toMatchObject({ showMeta: true, showAction: false });
    expect(short).toMatchObject({ showMeta: false, showAction: false });
  });

  it("keeps room for the page dots on a touch screen", () => {
    const mouse = posterLayout({ width: 780, height: 250 });
    const touch = posterLayout({ width: 780, height: 250 }, { touch: true });

    if (mouse.mode !== "strip" || touch.mode !== "strip")
      throw new Error("strip expected");
    expect(mouse.posterHeight - touch.posterHeight).toBe(16);
  });

  it("switches to a list of rows when the widget is narrow", () => {
    expect(posterLayout({ width: 228, height: 252 }, TO_WATCH)).toEqual({
      mode: "list",
      rows: 4,
      showAction: true,
    });
  });

  it("stays a list below a wider threshold when asked", () => {
    expect(
      posterLayout({ width: 400, height: 252 }, { stripMinWidth: 480 }),
    ).toMatchObject({ mode: "list" });
  });
});

describe("rowsLayout", () => {
  it("fits as many rows as the height allows", () => {
    expect(rowsLayout({ width: 228, height: 196 })).toEqual({
      columns: 1,
      count: 3,
    });
  });

  it("splits into two columns once it's wide", () => {
    expect(rowsLayout({ width: 600, height: 196 })).toEqual({
      columns: 2,
      count: 6,
    });
  });
});
