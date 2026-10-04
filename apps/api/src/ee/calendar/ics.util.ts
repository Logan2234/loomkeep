import type { CalendarEntryDto } from "@loomkeep/shared";
import { utcDateKey } from "../../common/date.util";

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
  return utcDateKey(date).replace(/-/g, "");
}

function formatTimestampUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function eventSummary(entry: CalendarEntryDto): string {
  if (entry.game) return entry.game.title;
  const title = entry.mediaItem?.title ?? "";
  if (entry.mediaItem?.type === "MOVIE") return title;
  return `${title} S${String(entry.seasonNumber).padStart(2, "0")}E${String(entry.episodeNumber).padStart(2, "0")}`;
}

function eventUid(entry: CalendarEntryDto): string {
  if (entry.game) return `${entry.game.id}-game@loomkeep.app`;
  const id = entry.mediaItem?.id ?? "";
  return entry.mediaItem?.type === "MOVIE"
    ? `${id}-movie-${entry.releaseRegion}@loomkeep.app`
    : `${id}-${entry.seasonNumber}-${entry.episodeNumber}@loomkeep.app`;
}

/** Renders a user's upcoming-release calendar as an RFC 5545 .ics feed. */
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
    const start = new Date(entry.airDate);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${eventUid(entry)}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${formatDateOnly(start)}`,
    );

    // A game dated to a month spans it, rather than claiming its 1st.
    if (entry.releasePrecision === "MONTH") {
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      lines.push(`DTEND;VALUE=DATE:${formatDateOnly(end)}`);
    }

    lines.push(`SUMMARY:${escapeText(eventSummary(entry))}`);

    if (entry.episodeTitle) {
      lines.push(`DESCRIPTION:${escapeText(entry.episodeTitle)}`);
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}
