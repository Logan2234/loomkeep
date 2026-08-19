import { m } from "$lib/paraglide/messages";

export const THEME_DEFINITIONS = [
  {
    mode: "dark" as const,
    label: m.common_theme_dark(),
    bg: "#0c0d10",
    surface: "#15171c",
    line: "#2a2e38",
    accent: "#f5b841",
  },
  {
    mode: "light" as const,
    label: m.common_theme_light(),
    bg: "#f2ebdc",
    surface: "#ffffff",
    line: "#d9cba9",
    accent: "#96570a",
  },
];
