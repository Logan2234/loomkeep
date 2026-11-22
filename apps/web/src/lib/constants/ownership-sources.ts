import { m } from "#lib/paraglide/messages.js";

export const GAME_OWNERSHIP_STATUS_OPTIONS = [
  {
    value: "NONE",
    get label() {
      return m.common_none();
    },
  },
  {
    value: "PHYSICAL",
    get label() {
      return m.ownership_physical();
    },
  },
  {
    value: "DIGITAL",
    get label() {
      return m.ownership_digital();
    },
  },
  {
    value: "SUBSCRIPTION",
    get label() {
      return m.ownership_subscription();
    },
  },
  {
    value: "BORROWED",
    get label() {
      return m.ownership_borrowed();
    },
  },
];

export const GAME_OWNERSHIP_SOURCES: Record<string, string[]> = {
  PHYSICAL: ["BOXED", "LOOSE", "SEALED", "COLLECTOR"],
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
  {
    value: "NONE",
    get label() {
      return m.common_none();
    },
  },
  {
    value: "PHYSICAL",
    get label() {
      return m.ownership_physical();
    },
  },
  {
    value: "DIGITAL",
    get label() {
      return m.ownership_ebook();
    },
  },
  {
    value: "AUDIO",
    get label() {
      return m.ownership_audio();
    },
  },
  {
    value: "BORROWED",
    get label() {
      return m.ownership_borrowed();
    },
  },
];

export const BOOK_OWNERSHIP_SOURCES: Record<string, string[]> = {
  PHYSICAL: ["POCKET", "PAPERBACK", "HARDCOVER", "BOX_SET"],
  DIGITAL: ["Kindle", "Kobo", "Google Play Livres", "Apple Books"],
  AUDIO: ["Audible", "Kobo (audio)", "Spotify"],
};

export const MEDIA_OWNERSHIP_STATUS_OPTIONS = [
  {
    value: "NONE",
    get label() {
      return m.common_none();
    },
  },
  {
    value: "PHYSICAL",
    get label() {
      return m.ownership_physical();
    },
  },
  {
    value: "DIGITAL",
    get label() {
      return m.ownership_digital();
    },
  },
  {
    value: "STREAMING",
    get label() {
      return m.ownership_streaming();
    },
  },
  {
    value: "BORROWED",
    get label() {
      return m.ownership_borrowed_rented();
    },
  },
];

export const MEDIA_OWNERSHIP_SOURCES: Record<string, string[]> = {
  PHYSICAL: ["DVD", "BLU_RAY", "UHD_BLU_RAY", "VHS"],
  DIGITAL: ["Apple TV/iTunes", "Google Play", "Amazon Video"],
  STREAMING: ["Netflix", "Prime Video", "Disney+", "Canal+"],
};

export const MUSIC_OWNERSHIP_STATUS_OPTIONS = [
  {
    value: "NONE",
    get label() {
      return m.common_none();
    },
  },
  {
    value: "PHYSICAL",
    get label() {
      return m.ownership_physical_music();
    },
  },
  {
    value: "DIGITAL",
    get label() {
      return m.ownership_digital();
    },
  },
  {
    value: "STREAMING",
    get label() {
      return m.ownership_streaming();
    },
  },
  {
    value: "BORROWED",
    get label() {
      return m.ownership_borrowed();
    },
  },
];

export const MUSIC_OWNERSHIP_SOURCES: Record<string, string[]> = {
  PHYSICAL: ["VINYL", "CD", "CASSETTE"],
  DIGITAL: ["Bandcamp", "iTunes", "Amazon Music"],
  STREAMING: ["Spotify", "Apple Music", "Deezer", "YouTube Music"],
};

// A physical copy's format is kept in ownershipSource like a store's name,
// but as a code: "Steam" reads the same in every language, "Paperback"
// doesn't. Anything else there (a store, a typed value) shows as written.
const PHYSICAL_FORMAT_LABELS: Record<string, () => string> = {
  DVD: () => "DVD",
  BLU_RAY: () => "Blu-ray",
  UHD_BLU_RAY: () => m.ownership_format_uhd_blu_ray(),
  VHS: () => "VHS",
  BOXED: () => m.ownership_format_boxed(),
  LOOSE: () => m.ownership_format_loose(),
  SEALED: () => m.ownership_format_sealed(),
  COLLECTOR: () => m.ownership_format_collector(),
  POCKET: () => m.ownership_format_pocket(),
  PAPERBACK: () => m.ownership_format_paperback(),
  HARDCOVER: () => m.ownership_format_hardcover(),
  BOX_SET: () => m.ownership_format_box_set(),
  VINYL: () => m.ownership_format_vinyl(),
  CD: () => "CD",
  CASSETTE: () => m.ownership_format_cassette(),
};

/** How an ownership detail reads: a physical format translated, else as stored. */
export function ownershipSourceLabel(source: string): string {
  return PHYSICAL_FORMAT_LABELS[source]?.() ?? source;
}
