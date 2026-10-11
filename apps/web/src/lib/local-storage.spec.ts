import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readSessionStorage,
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
