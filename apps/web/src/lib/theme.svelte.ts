import { STORAGE_KEYS } from "#lib/constants/storage-keys.js";
import {
  readStorage,
  removeStorage,
  writeStorage,
} from "#lib/local-storage.js";
import { browser } from "$app/env";

const STORAGE_KEY = STORAGE_KEYS.theme;
export const THEME_COLOR = { light: "#f7f5f3", dark: "#0c0d10" } as const;

type Mode = "light" | "dark";
type ThemeChoice = Mode | "system";

const systemMode = (): Mode =>
  matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

// Global theme state (Svelte 5 runes). Persists the manual choice in
//  localStorage; no saved choice means following the OS. The initial
//  `.dark` class is applied by an inline script in app.html (no-flash).
class ThemeState {
  mode = $state<Mode>("light");
  choice = $state<ThemeChoice>("system");

  /** Reads the same source as the app.html boot script and syncs the store. */
  init(): void {
    if (!browser) return;
    const saved = readStorage(STORAGE_KEY);
    this.choice = saved === "dark" || saved === "light" ? saved : "system";
    this.apply(this.choice === "system" ? systemMode() : this.choice);
    // With no choice saved, the theme follows the system's, live.
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.(
      "change",
      (event) => {
        if (this.choice === "system") {
          this.apply(event.matches ? "dark" : "light");
        }
      },
    );
  }

  set(choice: ThemeChoice): void {
    this.choice = choice;
    if (!browser) return;

    if (choice === "system") {
      removeStorage(STORAGE_KEY);
      this.apply(systemMode());
    } else {
      writeStorage(STORAGE_KEY, choice);
      this.apply(choice);
    }
  }

  toggle(): void {
    this.set(this.mode === "dark" ? "light" : "dark");
  }

  private apply(mode: Mode): void {
    this.mode = mode;
    if (!browser) return;
    document.documentElement.classList.toggle("dark", mode === "dark");
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", THEME_COLOR[mode]);
  }
}

export const theme = new ThemeState();
