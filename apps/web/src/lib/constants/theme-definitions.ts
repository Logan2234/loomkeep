import { m } from "#lib/paraglide/messages.js";

export const DARK_THEME = {
  mode: "dark" as const,
  label: m.common_theme_dark(),
  bg: "#0c0d10",
  surface: "#15171c",
  line: "#2a2e38",
  accent: "#f5b841",
};

export const LIGHT_THEME = {
  mode: "light" as const,
  label: m.common_theme_light(),
  bg: "#f2ebdc",
  surface: "#ffffff",
  line: "#d9cba9",
  accent: "#96570a",
};

export const THEME_DEFINITIONS = [
  // Drawn from the two below, split along a diagonal.
  { ...DARK_THEME, mode: "system" as const, label: m.common_system() },
  DARK_THEME,
  LIGHT_THEME,
];

export type ThemeDefinition = (typeof THEME_DEFINITIONS)[number];
