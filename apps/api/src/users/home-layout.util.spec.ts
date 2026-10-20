import { readHomeLayout, toHomeLayoutJson } from "./home-layout.util";

describe("stored home layout", () => {
  const layout = {
    widgets: [
      {
        id: "note-1",
        type: "note" as const,
        x: 0,
        y: 0,
        w: 4,
        h: 2,
        config: { text: "Reading list" },
      },
    ],
  };
  it("round-trips a layout with widget configuration through Prisma JSON", () => {
    expect(readHomeLayout(toHomeLayoutJson(layout))).toEqual(layout);
  });
  it("does not expose malformed stored layouts as a typed DTO", () => {
    expect(readHomeLayout(null)).toBeNull();
    expect(readHomeLayout({ widgets: "invalid" })).toBeNull();
    expect(
      readHomeLayout({ widgets: [{ ...layout.widgets[0], x: "0" }] }),
    ).toBeNull();
  });
});
