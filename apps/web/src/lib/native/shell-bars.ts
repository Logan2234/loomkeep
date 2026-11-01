import { THEME_COLOR, theme } from "#lib/theme.svelte.js";
import { Capacitor, registerPlugin } from "@capacitor/core";

/** apps/mobile's own plugin (ShellThemePlugin.java). */
export const ShellTheme = registerPlugin<{
  setBackground(options: {
    color: string;
    mode?: "light" | "dark";
    followsSystem?: boolean;
  }): Promise<void>;
}>("ShellTheme");

// The theme's background under Drawer's 40 % black veil.
const DIMMED_COLOR = { light: "#949392", dark: "#07080a" } as const;

let dimmers = 0;

function paint(): void {
  if (!Capacitor.isPluginAvailable("ShellTheme")) return;
  const colors = dimmers > 0 ? DIMMED_COLOR : THEME_COLOR;
  ShellTheme.setBackground({ color: colors[theme.mode] }).catch(() => {});
}

/**
 * Where the WebView stops at the system bars, the window paints them and a
 * veil in the page can't reach: a sheet dims them through the window.
 * Returns the teardown.
 */
export function dimSystemBars(): () => void {
  dimmers++;
  paint();

  return () => {
    dimmers--;
    paint();
  };
}
