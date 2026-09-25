import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import "reflect-metadata";
import { HomeLayoutBody } from "./home-layout.dto";

async function errorsFor(widgets: unknown[]) {
  return validate(plainToInstance(HomeLayoutBody, { widgets }));
}

const quickLinks = (links: unknown[]) => ({
  id: "w1",
  type: "quickLinks",
  x: 0,
  y: 0,
  w: 3,
  h: 4,
  config: { links },
});

describe("HomeLayoutBody", () => {
  it("accepts app screens and http(s) links", async () => {
    const errors = await errorsFor([
      quickLinks([
        { kind: "app", id: "stats" },
        { kind: "url", url: "https://jellyfin.example.com", label: "Jellyfin" },
      ]),
    ]);

    expect(errors).toEqual([]);
  });

  // The address becomes an href on the home page.
  it("rejects a link that isn't http(s)", async () => {
    const errors = await errorsFor([
      quickLinks([{ kind: "url", url: "javascript:alert(1)", label: "x" }]),
    ]);

    expect(errors).not.toEqual([]);
  });

  it("rejects an empty page", async () => {
    expect(await errorsFor([])).not.toEqual([]);
  });

  it("rejects an unknown widget kind and a widget outside the grid", async () => {
    const errors = await errorsFor([
      { id: "w1", type: "weather", x: 0, y: 0, w: 3, h: 3 },
      { id: "w2", type: "toWatch", x: 12, y: 0, w: 13, h: 3 },
    ]);

    expect(errors).not.toEqual([]);
  });

  it("accepts a widget's order and filters, and refuses unknown ones", async () => {
    const podium = (config: object) => ({
      id: "p",
      type: "friendsPodium",
      x: 0,
      y: 0,
      w: 3,
      h: 5,
      config,
    });

    expect(
      await errorsFor([
        podium({ scope: "global", period: "all" }),
        {
          ...podium({ sort: "title", ownOnly: true }),
          id: "l",
          type: "myLists",
        },
        { ...podium({ mediaTypes: ["MOVIE"] }), id: "t", type: "toWatch" },
      ]),
    ).toEqual([]);
    expect(await errorsFor([podium({ scope: "everyone" })])).not.toEqual([]);
    expect(await errorsFor([podium({ sort: "random" })])).not.toEqual([]);
    expect(await errorsFor([podium({ mediaTypes: ["PODCAST"] })])).not.toEqual(
      [],
    );
  });
});
