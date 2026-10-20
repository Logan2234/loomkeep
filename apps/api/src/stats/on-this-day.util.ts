import type { OnThisDayEntryDto } from "@loomkeep/shared";

const DAY_MS = 86_400_000;
/** Days either side of the anniversary still counted as "that day". */
const SPREAD_DAYS = 3;
const MAX_ENTRIES = 20;

/**
 * The week around `date` one year earlier, `date` being the viewer's local
 * day (YYYY-MM-DD). A 29 February maps to the 28th rather than rolling
 * over to 1 March.
 */
export function anniversaryWindow(date: string): {
  center: Date;
  from: Date;
  to: Date;
} {
  const [year, month, day] = date.split("-").map(Number);
  const lastDayOfMonth = new Date(Date.UTC(year - 1, month, 0)).getUTCDate();
  const center = new Date(
    Date.UTC(year - 1, month - 1, Math.min(day, lastDayOfMonth)),
  );
  return {
    center,
    from: new Date(center.getTime() - SPREAD_DAYS * DAY_MS),
    to: new Date(center.getTime() + (SPREAD_DAYS + 1) * DAY_MS),
  };
}

/** Closest to the anniversary first, capped. */
export function rankByAnniversary(
  entries: OnThisDayEntryDto[],
  center: Date,
): OnThisDayEntryDto[] {
  const distance = (entry: OnThisDayEntryDto) =>
    Math.abs(new Date(entry.date).getTime() - center.getTime());
  return [...entries]
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, MAX_ENTRIES);
}
