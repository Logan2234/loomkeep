// Canonical per-domain display metadata for the stats feature (labels, CSS
// color variable). Distinct from ProfileView's own DOMAIN_LABEL map
// (different context, not worth coupling) but the single source for anything
// under lib/components/stats/.

import type { StatsDomain, StatsStatusBucket } from "@tracklore/shared";

export const STATS_DOMAIN_LABEL: Record<StatsDomain, string> = {
  MEDIA: "Vidéo",
  GAMES: "Jeux",
  BOOKS: "Livres",
  MUSIC: "Musique",
};

// CSS var name (see app.css) carrying this domain's validated stat hue.
export const STATS_DOMAIN_COLOR_VAR: Record<StatsDomain, string> = {
  MEDIA: "var(--stat-media)",
  GAMES: "var(--stat-games)",
  BOOKS: "var(--stat-books)",
  MUSIC: "var(--stat-music)",
};

// The shared status funnel (dim to-do → amber in-progress → green done → red
// dropped), shown when the overview is filtered to a single domain.
export const STATUS_BUCKET_ORDER: StatsStatusBucket[] = [
  "PLANNED",
  "IN_PROGRESS",
  "DONE",
  "DROPPED",
];
export const STATUS_BUCKET_LABEL: Record<StatsStatusBucket, string> = {
  PLANNED: "À faire",
  IN_PROGRESS: "En cours",
  DONE: "Terminé",
  DROPPED: "Abandonné",
};
export const STATUS_BUCKET_COLOR: Record<StatsStatusBucket, string> = {
  PLANNED: "var(--dim)",
  IN_PROGRESS: "var(--accent)",
  DONE: "var(--success)",
  DROPPED: "var(--danger)",
};
