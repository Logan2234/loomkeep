import { afterEach, describe, expect, it, vi } from "vitest";
import { accessibility } from "./accessibility.svelte";
import { navStyle } from "./navStyle.svelte";
import { theme } from "./theme.svelte";

vi.mock("$app/env", () => ({ browser: true }));
afterEach(() => vi.unstubAllGlobals());

describe("preferences with unavailable storage", () => {
  it.each(["methods", "getter"])(
    "keeps preferences usable when storage %s throw",
    (failure) => {
      if (failure === "getter") {
        vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
          throw new Error("blocked");
        });
      } else {
        const blocked = () => {
          throw new Error("blocked");
        };

        vi.stubGlobal("localStorage", {
          getItem: blocked,
          setItem: blocked,
          removeItem: blocked,
        });
      }

      try {
        expect(() => accessibility.init()).not.toThrow();
        expect(() => theme.init()).not.toThrow();
        expect(() => navStyle.init()).not.toThrow();
        expect(() => accessibility.setContrast("high")).not.toThrow();
        expect(() => theme.toggle()).not.toThrow();
        expect(() => navStyle.set("dock")).not.toThrow();
        expect(
          document.documentElement.classList.contains("a11y-high-contrast"),
        ).toBe(true);
        expect(navStyle.choice).toBe("dock");
      } finally {
        vi.restoreAllMocks();
      }
    },
  );
});
