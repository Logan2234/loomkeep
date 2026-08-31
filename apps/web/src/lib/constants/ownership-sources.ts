import { m } from "$lib/paraglide/messages";

export const GAME_OWNERSHIP_STATUS_OPTIONS = [
  { value: "NONE", label: m.common_none() },
  { value: "PHYSICAL", label: m.ownership_physical() },
  { value: "DIGITAL", label: m.ownership_digital() },
  { value: "SUBSCRIPTION", label: m.ownership_subscription() },
  { value: "BORROWED", label: m.ownership_borrowed() },
];

export const GAME_OWNERSHIP_SOURCES: Record<string, string[]> = {
  DIGITAL: [
    "Steam",
    "Epic Games Store",
    "GOG",
    "PlayStation Store",
    "Xbox Store",
    "Nintendo eShop",
  ],
  SUBSCRIPTION: [
    "Xbox Game Pass",
    "PS Plus Extra/Premium",
    "EA Play",
    "Ubisoft+",
  ],
};

export const BOOK_OWNERSHIP_STATUS_OPTIONS = [
  { value: "NONE", label: m.common_none() },
  { value: "PHYSICAL", label: m.ownership_physical() },
  { value: "DIGITAL", label: m.ownership_ebook() },
  { value: "AUDIO", label: m.ownership_audio() },
  { value: "BORROWED", label: m.ownership_borrowed() },
];

export const BOOK_OWNERSHIP_SOURCES: Record<string, string[]> = {
  DIGITAL: ["Kindle", "Kobo", "Google Play Livres", "Apple Books"],
  AUDIO: ["Audible", "Kobo (audio)", "Spotify"],
};

export const MEDIA_OWNERSHIP_STATUS_OPTIONS = [
  { value: "NONE", label: m.common_none() },
  { value: "PHYSICAL", label: m.ownership_physical() },
  { value: "DIGITAL", label: m.ownership_digital() },
  { value: "STREAMING", label: m.ownership_streaming() },
  { value: "BORROWED", label: m.ownership_borrowed_rented() },
];

export const MEDIA_OWNERSHIP_SOURCES: Record<string, string[]> = {
  DIGITAL: ["Apple TV/iTunes", "Google Play", "Amazon Video"],
  STREAMING: ["Netflix", "Prime Video", "Disney+", "Canal+"],
};

export const MUSIC_OWNERSHIP_STATUS_OPTIONS = [
  { value: "NONE", label: m.common_none() },
  { value: "PHYSICAL", label: m.ownership_physical_music() },
  { value: "DIGITAL", label: m.ownership_digital() },
  { value: "STREAMING", label: m.ownership_streaming() },
  { value: "BORROWED", label: m.ownership_borrowed() },
];

export const MUSIC_OWNERSHIP_SOURCES: Record<string, string[]> = {
  DIGITAL: ["Bandcamp", "iTunes", "Amazon Music"],
  STREAMING: ["Spotify", "Apple Music", "Deezer", "YouTube Music"],
};
