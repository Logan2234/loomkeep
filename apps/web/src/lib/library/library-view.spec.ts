import { afterEach, describe, expect, it, vi } from "vitest";
import { readLibraryViewMode, writeLibraryViewMode } from "./library-view";

function stubStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
  });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("library view mode", () => {
  it("remembers the mode separately for each library", () => {
    const store = stubStorage();

    writeLibraryViewMode("BOOKS", "table");

    expect(store.get("lk-library-view-books")).toBe("table");
    expect(readLibraryViewMode("BOOKS")).toBe("table");
    expect(readLibraryViewMode("MEDIA")).toBe("cards");
  });

  it("falls back to cards on an unknown stored value", () => {
    const store = stubStorage();
    store.set("lk-library-view-games", "carousel");

    expect(readLibraryViewMode("GAMES")).toBe("cards");
  });

  it("falls back to cards when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    });

    expect(() => writeLibraryViewMode("MUSIC", "wall")).not.toThrow();
    expect(readLibraryViewMode("MUSIC")).toBe("cards");
  });
});
