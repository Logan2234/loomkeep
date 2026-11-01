import { expect, it } from "vitest";
import { pageTransition } from "./page-transition";

it("slides forward into a deeper page", () => {
  expect(pageTransition("/app/media", "/app/media/movie/1")).toBe("forward");
});

it("slides back to a shallower page, or on the back button", () => {
  expect(pageTransition("/app/media/movie/1", "/app/media")).toBe("back");
  expect(pageTransition("/app", "/app/stats", -1)).toBe("back");
});

it("fades between pages at the same level", () => {
  expect(pageTransition("/app/stats", "/app/search")).toBe("fade");
});
