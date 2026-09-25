import { describe, expect, it } from "vitest";
import { posterLayout, rowsLayout } from "./sizing";

const TO_WATCH = { meta: 12, action: 36 };

describe("posterLayout", () => {
  it("shows posters with their progress and button when there's room", () => {
    expect(posterLayout({ width: 780, height: 252 }, TO_WATCH)).toEqual({
      mode: "strip",
      posterWidth: 111,
      showMeta: true,
      showAction: true,
    });
  });

  it("drops the button, then the progress, as the widget gets shorter", () => {
    const medium = posterLayout({ width: 780, height: 196 }, TO_WATCH);
    const short = posterLayout({ width: 780, height: 140 }, TO_WATCH);

    expect(medium).toMatchObject({ showMeta: true, showAction: false });
    expect(short).toMatchObject({ showMeta: false, showAction: false });
  });

  it("grows the posters with the height, up to a cap", () => {
    const tall = posterLayout({ width: 780, height: 250 });
    const huge = posterLayout({ width: 780, height: 900 });

    expect(tall).toMatchObject({ posterWidth: 141 });
    expect(huge).toMatchObject({ posterWidth: 173 });
  });

  it("switches to a list of rows when the widget is narrow", () => {
    expect(posterLayout({ width: 228, height: 252 }, TO_WATCH)).toEqual({
      mode: "list",
      rows: 4,
      showAction: true,
    });
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
