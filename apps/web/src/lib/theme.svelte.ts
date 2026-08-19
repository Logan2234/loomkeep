import { browser } from "$app/environment";

const STORAGE_KEY = "tl-theme";
const THEME_COLOR = { light: "##f2ebdc", dark: "#0c0d10" } as const;

type Mode = "light" | "dark";

// Global theme state (Svelte 5 runes). Persists the manual choice in
//  localStorage; falls back to the OS preference when none is set. The initial
//  `.dark` class is applied by an inline script in app.html (no-flash).
class ThemeState {
  mode = $state<Mode>("light");

  /** Reads the same source as the app.html boot script and syncs the store. */
  init(): void {
    if (!browser) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    const dark = saved
      ? saved === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    this.apply(dark ? "dark" : "light");
  }

  toggle(): void {
    this.apply(this.mode === "dark" ? "light" : "dark");
    if (browser) localStorage.setItem(STORAGE_KEY, this.mode);
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
