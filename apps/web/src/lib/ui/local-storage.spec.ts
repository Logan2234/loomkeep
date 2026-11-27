import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readSessionStorage,
  readStorage,
  removeSessionStorage,
  writeSessionStorage,
} from "./local-storage";

afterEach(() => vi.unstubAllGlobals());

describe("optional session storage", () => {
  it("tolerates blocked reads, writes and removal", () => {
    const blocked = () => {
      throw new Error("Storage blocked");
    };

    vi.stubGlobal("sessionStorage", {
      getItem: blocked,
      setItem: blocked,
      removeItem: blocked,
    });
    expect(readSessionStorage("progress")).toBeNull();
    expect(() => writeSessionStorage("progress", "1")).not.toThrow();
    expect(() => removeSessionStorage("progress")).not.toThrow();
  });
});

describe("storage key migration", () => {
  it.each(["localStorage", "sessionStorage"] as const)(
    "migrates %s preferences without losing the old value",
    (name) => {
      const values = new Map([["old-key", "0"]]);
      vi.stubGlobal(name, {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      });
      const read = name === "localStorage" ? readStorage : readSessionStorage;
      expect(read("lk-key", "old-key")).toBe("0");
      expect(values.get("lk-key")).toBe("0");
      expect(values.has("old-key")).toBe(false);
    },
  );
  it("keeps the latest preference when both versions exist", () => {
    const values = new Map([
      ["old-key", "old"],
      ["lk-key", "new"],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
    });
    expect(readStorage("lk-key", "old-key")).toBe("new");
    expect(values.has("old-key")).toBe(false);
  });
  it("still reads the legacy preference when writing is blocked", () => {
    const values = new Map([["old-key", "saved"]]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: () => {
        throw new Error("Quota exceeded");
      },
      removeItem: vi.fn(),
    });
    expect(readStorage("lk-key", "old-key")).toBe("saved");
    expect(values.get("old-key")).toBe("saved");
    expect(values.has("lk-key")).toBe(false);
  });
  it("remains safe during SSR", () => {
    vi.stubGlobal("localStorage", undefined);
    vi.stubGlobal("sessionStorage", undefined);
    expect(readStorage("lk-key", "old-key")).toBeNull();
    expect(readSessionStorage("lk-key", "old-key")).toBeNull();
  });
});
