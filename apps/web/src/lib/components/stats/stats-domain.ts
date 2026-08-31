// Canonical per-domain display metadata for the stats feature (labels, CSS
// color variable). Distinct from ProfileView's own DOMAIN_LABEL map
// (different context, not worth coupling) but the single source for anything
// under lib/components/stats/.

import { m } from "$lib/paraglide/messages.js";
import type { StatsDomain, StatsStatusBucket } from "@loomkeep/shared";

export const STATS_DOMAIN_LABEL: Record<StatsDomain, string> = {
  get MEDIA() {
    return m.common_Media();
  },
  get GAMES() {
    return m.common_Games();
  },
  get BOOKS() {
    return m.common_Books();
  },
  get MUSIC() {
    return m.common_Music();
  },
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
  get PLANNED() {
    return m.library_status_planned();
  },
  get IN_PROGRESS() {
    return m.library_status_in_progress();
  },
  get DONE() {
    return m.library_status_completed();
  },
  get DROPPED() {
    return m.library_status_dropped();
  },
};
export const STATUS_BUCKET_COLOR: Record<StatsStatusBucket, string> = {
  PLANNED: "var(--dim)",
  IN_PROGRESS: "var(--accent)",
  DONE: "var(--success)",
  DROPPED: "var(--danger)",
};
