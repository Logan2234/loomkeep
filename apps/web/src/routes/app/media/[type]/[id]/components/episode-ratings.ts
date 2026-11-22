import { formatNumber } from "#lib/format.js";

const n = (value: number) => formatNumber(value);

/** Colour steps of the episode ratings grid, lowest first (TMDB's /10). */
export const RATING_BANDS = [
  { min: 0, cls: "bg-danger text-white", label: () => `< ${n(6)}` },
  { min: 6, cls: "bg-warning text-white", label: () => `${n(6)} – ${n(7)}` },
  {
    min: 7,
    cls: "bg-accent text-accent-fg",
    label: () => `${n(7)} – ${n(7.8)}`,
  },
  {
    min: 7.8,
    cls: "bg-success/70 text-white",
    label: () => `${n(7.8)} – ${n(8.5)}`,
  },
  { min: 8.5, cls: "bg-success text-white", label: () => `≥ ${n(8.5)}` },
] as const;

/** The band a rating falls in; null when TMDB has none for the episode. */
export function ratingBand(rating: number | null) {
  if (rating === null) return null;
  return [...RATING_BANDS].reverse().find((band) => rating >= band.min)!;
}
