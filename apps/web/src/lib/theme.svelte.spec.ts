import { STORAGE_KEYS } from "#lib/constants/storage-keys.js";
import { beforeEach, expect, it, vi } from "vitest";
import { theme } from "./theme.svelte";

vi.mock("$app/env", () => ({ browser: true }));

function systemPrefers(mode: "light" | "dark") {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes(mode),
    addEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  localStorage.clear();
  systemPrefers("dark");
});

it("follows the system when it's chosen, forgetting the manual choice", () => {
  theme.set("light");
  expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe("light");
  expect(theme.mode).toBe("light");

  theme.set("system");

  expect(localStorage.getItem(STORAGE_KEYS.theme)).toBeNull();
  expect(theme.choice).toBe("system");
  expect(theme.mode).toBe("dark");
});

it("says which choice a device already has", () => {
  localStorage.setItem(STORAGE_KEYS.theme, "light");
  theme.init();
  expect(theme.choice).toBe("light");

  localStorage.removeItem(STORAGE_KEYS.theme);
  theme.init();
  expect(theme.choice).toBe("system");
});

it("leaves the system's hands on a manual toggle", () => {
  theme.set("system");
  theme.toggle();

  expect(theme.choice).toBe("light");
  expect(theme.mode).toBe("light");
});
