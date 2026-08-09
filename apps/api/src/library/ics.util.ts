import type { CalendarEntryDto } from "@loomkeep/shared";

const CRLF = "\r\n";
// RFC 5545 §3.1: content lines must be folded at 75 octets, continuation
// lines start with a single space.
const FOLD_WIDTH = 75;

function foldLine(line: string): string {
  if (line.length <= FOLD_WIDTH) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > FOLD_WIDTH) {
    parts.push(rest.slice(0, FOLD_WIDTH));
    rest = rest.slice(FOLD_WIDTH);
  }
  parts.push(rest);
  return parts.join(CRLF + " ");
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// Episode air dates carry no reliable time-of-day (TMDB/AniList give a date),
// so events are rendered as all-day (VALUE=DATE) rather than timed — a timed
// UTC midnight would shift to the wrong calendar day in western timezones.
function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function formatTimestampUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Renders a user's upcoming-episode calendar as an RFC 5545 .ics feed. */
export function buildCalendarIcs(entries: CalendarEntryDto[]): string {
  const now = formatTimestampUtc(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Loomkeep//Calendrier de sorties//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Loomkeep",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
  ];

  for (const entry of entries) {
    const code = `S${String(entry.seasonNumber).padStart(2, "0")}E${String(entry.episodeNumber).padStart(2, "0")}`;
    const summary = `${entry.mediaItem.title} ${code}`;
    const uid = `${entry.mediaItem.id}-${entry.seasonNumber}-${entry.episodeNumber}@loomkeep.app`;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${formatDateOnly(new Date(entry.airDate))}`,
      `SUMMARY:${escapeText(summary)}`,
    );
    if (entry.episodeTitle) {
      lines.push(`DESCRIPTION:${escapeText(entry.episodeTitle)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}
