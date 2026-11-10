import { describe, expect, it } from "vitest";
import {
  isCreatorPath,
  isWorkPath,
  posterOfLink,
  tappedPortrait,
  tappedPoster,
} from "./shared-poster.svelte";

function html(markup: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = markup;
  return root;
}

describe("isWorkPath", () => {
  it("recognises a work's page in every domain", () => {
    for (const path of [
      "/app/media/movie/13",
      "/app/games/119133",
      "/app/books/OL893414W",
      "/app/music/abc",
    ]) {
      expect(isWorkPath(path)).toBe(true);
    }
  });

  it("leaves libraries and settings out", () => {
    for (const path of ["/app/media", "/app/games", "/app/settings/import"]) {
      expect(isWorkPath(path)).toBe(false);
    }
  });
});

describe("posterOfLink", () => {
  it("finds a poster inside the link", () => {
    const root = html(`<a href="/x"><div data-work-poster id="p"></div></a>`);
    expect(posterOfLink(root.querySelector("a")!)?.id).toBe("p");
  });

  it("finds a poster beside the link, the way PosterCard lays them out", () => {
    const root = html(
      `<div><a href="/x"></a><div data-work-poster id="p"></div></div>`,
    );
    expect(posterOfLink(root.querySelector("a")!)?.id).toBe("p");
  });

  it("takes the closest poster in a grid, not the grid's first", () => {
    const root = html(`<div>
      <div><a href="/a"></a><div data-work-poster id="a"></div></div>
      <div><a href="/b"></a><div data-work-poster id="b"></div></div>
    </div>`);
    expect(posterOfLink(root.querySelector('a[href="/b"]')!)?.id).toBe("b");
  });
});

describe("tappedPoster", () => {
  it("ignores a tap on a link going somewhere else", () => {
    const root = html(`<a href="/a"><div data-work-poster></div></a>`);
    expect(tappedPoster(root.querySelector("a"), "/b")).toBeNull();
  });

  it("returns the poster of the link heading there", () => {
    const root = html(`<a href="/a"><div data-work-poster id="p"></div></a>`);
    expect(tappedPoster(root.querySelector("a"), "/a")?.id).toBe("p");
  });
});

describe("tappedPortrait", () => {
  it("returns the photo of the cast card or peek whose link was tapped", () => {
    const card = html(`<a href="/app/people/tmdb/505710">
      <div data-creator-portrait id="card"></div>Zendaya</a>`);
    const peek = html(`<div role="dialog">
      <div><div data-creator-portrait id="peek"></div></div>
      <div><a href="/app/people/tmdb/505710">See their page</a></div>
    </div>`);

    for (const [root, id] of [
      [card, "card"],
      [peek, "peek"],
    ] as const) {
      expect(
        tappedPortrait(root.querySelector("a"), "/app/people/tmdb/505710")?.id,
      ).toBe(id);
    }

    expect(isCreatorPath("/app/people/tmdb/505710")).toBe(true);
  });

  it("has nothing for a bare name or a link going elsewhere", () => {
    const name = html(`<a href="/app/people/tmdb/137427">Denis</a>`);
    expect(
      tappedPortrait(name.querySelector("a"), "/app/people/tmdb/137427"),
    ).toBeNull();
    const card = html(`<a href="/app/people/tmdb/505710">
      <div data-creator-portrait></div></a>`);
    expect(tappedPortrait(card.querySelector("a"), "/app/media")).toBeNull();
  });
});
