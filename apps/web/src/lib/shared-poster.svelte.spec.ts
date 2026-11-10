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
  const dialog = () =>
    html(`<div role="dialog">
      <div data-creator-portrait id="photo"></div>
      <a href="/app/people/tmdb/1190668">See their page</a>
    </div>`);

  it("returns the photo of the dialog whose link was tapped", () => {
    const root = dialog();
    expect(
      tappedPortrait(root.querySelector("a"), "/app/people/tmdb/1190668")?.id,
    ).toBe("photo");
    expect(isCreatorPath("/app/people/tmdb/1190668")).toBe(true);
  });

  it("has nothing for a name outside a dialog or a link going elsewhere", () => {
    const name = html(`<a href="/app/people/tmdb/137427">Denis</a>`);
    expect(
      tappedPortrait(name.querySelector("a"), "/app/people/tmdb/137427"),
    ).toBeNull();
    expect(
      tappedPortrait(dialog().querySelector("a"), "/app/media"),
    ).toBeNull();
  });
});
