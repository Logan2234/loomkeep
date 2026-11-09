import { describe, expect, it } from "vitest";
import { nextInRewatch } from "./rewatch";

const run = ["e1", "e2", "e3", "e4"];
const next = (seenAgain: string[]) =>
  nextInRewatch(run, (episode) => seenAgain.includes(episode));

describe("nextInRewatch", () => {
  it("starts from the first episode when nothing was seen again", () => {
    expect(next([])).toBe("e1");
  });

  it("follows the last episode seen again", () => {
    expect(next(["e1", "e2"])).toBe("e3");
  });

  it("doesn't go back to a skipped episode while later ones are left", () => {
    expect(next(["e1", "e3"])).toBe("e4");
  });

  it("comes back to a skipped episode once the end is reached", () => {
    expect(next(["e1", "e3", "e4"])).toBe("e2");
  });

  it("is null once every episode was seen again", () => {
    expect(next(run)).toBeNull();
  });
});
