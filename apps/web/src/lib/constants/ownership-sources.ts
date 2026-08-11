// Preset "detail" values offered per ownership status, per domain — purely a
// UX convenience list; the stored value is always a free-form string (see
// OwnershipField's "Autre…" escape hatch).

export const GAME_OWNERSHIP_STATUS_OPTIONS = [
  { value: "NONE", label: "Aucun" },
  { value: "PHYSICAL", label: "Physique" },
  { value: "DIGITAL", label: "Numérique" },
  { value: "SUBSCRIPTION", label: "Abonnement" },
  { value: "BORROWED", label: "Emprunté" },
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
  { value: "NONE", label: "Aucun" },
  { value: "PHYSICAL", label: "Physique" },
  { value: "DIGITAL", label: "Numérique (ebook)" },
  { value: "AUDIO", label: "Audio" },
  { value: "BORROWED", label: "Emprunté" },
];

export const BOOK_OWNERSHIP_SOURCES: Record<string, string[]> = {
  DIGITAL: ["Kindle", "Kobo", "Google Play Livres", "Apple Books"],
  AUDIO: ["Audible", "Kobo (audio)", "Spotify"],
};

export const MEDIA_OWNERSHIP_STATUS_OPTIONS = [
  { value: "NONE", label: "Aucun" },
  { value: "PHYSICAL", label: "Physique" },
  { value: "DIGITAL", label: "Numérique" },
  { value: "STREAMING", label: "Streaming" },
  { value: "BORROWED", label: "Emprunté/loué" },
];

export const MEDIA_OWNERSHIP_SOURCES: Record<string, string[]> = {
  DIGITAL: ["Apple TV/iTunes", "Google Play", "Amazon Video"],
  STREAMING: ["Netflix", "Prime Video", "Disney+", "Canal+"],
};

export const MUSIC_OWNERSHIP_STATUS_OPTIONS = [
  { value: "NONE", label: "Aucun" },
  { value: "PHYSICAL", label: "Physique (vinyle, CD)" },
  { value: "DIGITAL", label: "Numérique" },
  { value: "STREAMING", label: "Streaming" },
  { value: "BORROWED", label: "Emprunté" },
];

export const MUSIC_OWNERSHIP_SOURCES: Record<string, string[]> = {
  DIGITAL: ["Bandcamp", "iTunes", "Amazon Music"],
  STREAMING: ["Spotify", "Apple Music", "Deezer", "YouTube Music"],
};
