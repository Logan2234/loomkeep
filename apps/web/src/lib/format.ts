// Shared formatting helpers for UI display (French locale).

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Formats an ISO date string as e.g. "3 janv. 2026". */
export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

const fullDateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

/** Full date + time, e.g. "3 janvier 2026 à 14:32" — for a relative-time hover tooltip. */
export function formatFullDateTime(iso: string): string {
  return fullDateTimeFmt.format(new Date(iso));
}

const relFmt = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

/**
 * Compact relative time, e.g. "il y a 2 h", "hier". Falls back to an absolute
 * date past a week, where "il y a 9 j" reads worse than the plain date.
 */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);

  if (abs < 60) return "à l'instant";
  if (abs < 3600) return relFmt.format(Math.round(diffSec / 60), "minute");
  if (abs < 86_400) return relFmt.format(Math.round(diffSec / 3600), "hour");
  if (abs < 604_800) return relFmt.format(Math.round(diffSec / 86_400), "day");
  return formatDate(iso);
}

const BYTE_UNITS = ["Ko", "Mo", "Go"];

/** Byte size in the largest unit that keeps it readable, e.g. "218 Mo", "1,4 Go". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;

  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }

  return `${value.toFixed(value < 10 ? 1 : 0)} ${BYTE_UNITS[unit]}`.replace(
    ".",
    ",",
  );
}
