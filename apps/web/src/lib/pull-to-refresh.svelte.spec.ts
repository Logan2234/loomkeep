import { afterEach, describe, expect, it } from "vitest";
import { canStartPull, PULL_THRESHOLD, pullDistance } from "./pull-to-refresh";

afterEach(() => document.body.replaceChildren());

describe("pullDistance", () => {
  it("resists the finger, up to a limit", () => {
    expect(pullDistance(100)).toBe(50);
    expect(pullDistance(1000)).toBeLessThan(200);
    expect(pullDistance(-20)).toBe(0);
  });

  it("can reach the refresh threshold", () => {
    expect(pullDistance(10_000)).toBeGreaterThan(PULL_THRESHOLD);
  });
});

describe("canStartPull", () => {
  const inPage = (html: string) => {
    document.body.innerHTML = html;
    return document.querySelector("#target");
  };

  it("starts from the top of the page", () => {
    expect(canStartPull(inPage('<p id="target"></p>'), 0)).toBe(true);
  });

  it("not once the page has scrolled", () => {
    expect(canStartPull(inPage('<p id="target"></p>'), 40)).toBe(false);
  });

  it("not from a sheet or a field", () => {
    expect(
      canStartPull(inPage('<div role="dialog"><p id="target"></p></div>'), 0),
    ).toBe(false);
    expect(canStartPull(inPage('<input id="target" />'), 0)).toBe(false);
  });

  it("not from a list scrolled inside the page", () => {
    const target = inPage('<div id="list"><p id="target"></p></div>');
    document.querySelector("#list")!.scrollTop = 30;
    expect(canStartPull(target, 0)).toBe(false);
  });
});
