import type { GameStore, ListenService } from "@loomkeep/shared";

export interface ServiceBrand {
  name: string;
  color: string;
  foreground: string;
  monogram: string;
}

/**
 * Game stores and music services linked from a work's page. Shown as a
 * coloured monogram until their marks are added; the name always sits next
 * to it, so the mark is decorative.
 */
export const SERVICE_BRANDS: Record<GameStore | ListenService, ServiceBrand> = {
  STEAM: {
    name: "Steam",
    color: "#1b2838",
    foreground: "#ffffff",
    monogram: "St",
  },
  GOG: { name: "GOG", color: "#86328a", foreground: "#ffffff", monogram: "G" },
  EPIC: {
    name: "Epic Games",
    color: "#2a2a2a",
    foreground: "#ffffff",
    monogram: "E",
  },
  ITCH: {
    name: "itch.io",
    color: "#fa5c5c",
    foreground: "#ffffff",
    monogram: "it",
  },
  APP_STORE: {
    name: "App Store",
    color: "#1c7ef0",
    foreground: "#ffffff",
    monogram: "A",
  },
  GOOGLE_PLAY: {
    name: "Google Play",
    color: "#0f9d58",
    foreground: "#ffffff",
    monogram: "▶",
  },
  SPOTIFY: {
    name: "Spotify",
    color: "#1db954",
    foreground: "#000000",
    monogram: "S",
  },
  APPLE_MUSIC: {
    name: "Apple Music",
    color: "#fa2d48",
    foreground: "#ffffff",
    monogram: "♪",
  },
  DEEZER: {
    name: "Deezer",
    color: "#a238ff",
    foreground: "#ffffff",
    monogram: "D",
  },
  YOUTUBE_MUSIC: {
    name: "YouTube Music",
    color: "#ff0033",
    foreground: "#ffffff",
    monogram: "▶",
  },
  TIDAL: {
    name: "Tidal",
    color: "#000000",
    foreground: "#ffffff",
    monogram: "T",
  },
  QOBUZ: {
    name: "Qobuz",
    color: "#0070ef",
    foreground: "#ffffff",
    monogram: "Q",
  },
  BANDCAMP: {
    name: "Bandcamp",
    color: "#1da0c3",
    foreground: "#ffffff",
    monogram: "b",
  },
  AMAZON_MUSIC: {
    name: "Amazon",
    color: "#ff9900",
    foreground: "#111111",
    monogram: "a",
  },
};
