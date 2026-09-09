import type { EntryStatus } from "@loomkeep/shared";
import type { ImportShow, ParsedImport } from "../../media-import-model";

const MAX_ENTRIES = 20_000;
const MAX_WATCHED_EPISODES_PER_ENTRY = 10_000;

const STATUS: Record<string, EntryStatus> = {
  Watching: "WATCHING",
  Completed: "COMPLETED",
  "On-Hold": "WATCHING",
  Dropped: "DROPPED",
  "Plan to Watch": "PLANNED",
};

const PHYSICAL_STORAGE = new Set(["Blu-ray", "DVD / CD", "Retail DVD", "VHS"]);
const DIGITAL_STORAGE = new Set(["External HD", "Hard Drive", "NAS"]);

/** Parses the anime-only XML export downloaded from MyAnimeList. */
export function parseMyAnimeListXml(input: string): ParsedImport {
  if (/<!DOCTYPE|<!ENTITY/i.test(input)) {
    throw new Error(
      "XML declarations with external entities are not supported",
    );
  }

  if (!/<myanimelist\b[^>]*>/i.test(input)) {
    throw new Error("This is not a MyAnimeList XML export");
  }

  const info = firstElement(input, "myinfo");

  if (field(info, "user_export_type") !== "1") {
    throw new Error("Only MyAnimeList anime exports are supported");
  }

  const entries = allElements(input, "anime");

  if (entries.length > MAX_ENTRIES) {
    throw new Error("The export contains too many anime entries");
  }

  return {
    source: "myanimelist",
    shows: entries.map(parseAnime),
    movies: [],
  };
}

function parseAnime(xml: string): ImportShow {
  const malId = positiveInteger(field(xml, "series_animedb_id"));
  const title = field(xml, "series_title");
  const totalEpisodes = nonNegativeInteger(field(xml, "series_episodes"));
  const watchedEpisodes = nonNegativeInteger(field(xml, "my_watched_episodes"));
  const rawStatus = field(xml, "my_status");
  const status = STATUS[rawStatus];

  if (
    !malId ||
    !title ||
    totalEpisodes === null ||
    watchedEpisodes === null ||
    !status
  ) {
    throw new Error("An anime entry is missing a required MyAnimeList field");
  }

  if (watchedEpisodes > MAX_WATCHED_EPISODES_PER_ENTRY) {
    throw new Error(`Too many watched episodes for "${title}"`);
  }

  const isCompletedMovie =
    field(xml, "series_type").toLowerCase() === "movie" &&
    totalEpisodes === 1 &&
    watchedEpisodes >= 1;
  const sourceStatus = isCompletedMovie ? "COMPLETED" : status;
  const dates = datesForStatus(rawStatus, xml);
  const storage = ownershipFromStorage(field(xml, "my_storage"));
  const score = nonNegativeInteger(field(xml, "my_score"));

  return {
    title,
    externalIds: { anilist: String(malId) },
    episodes: Array.from({ length: watchedEpisodes }, (_, index) => ({
      season: 1,
      episode: index + 1,
      sourceEpisodeId: `mal:${malId}:${index + 1}`,
      watchedAt: null,
      totalWatches: 1,
    })),
    rating: score && score >= 1 && score <= 10 ? score : null,
    status: sourceStatus,
    ...dates,
    notes: field(xml, "my_comments") || null,
    ...storage,
  };
}

function datesForStatus(
  rawStatus: string,
  xml: string,
): Pick<ImportShow, "startedAt" | "finishedAt"> {
  if (
    rawStatus !== "Watching" &&
    rawStatus !== "On-Hold" &&
    rawStatus !== "Completed"
  ) {
    return { startedAt: null, finishedAt: null };
  }

  return {
    startedAt: parseDate(field(xml, "my_start_date")),
    finishedAt:
      rawStatus === "Completed"
        ? parseDate(field(xml, "my_finish_date"))
        : null,
  };
}

function ownershipFromStorage(
  storage: string,
): Pick<ImportShow, "ownershipStatus" | "ownershipSource"> {
  if (PHYSICAL_STORAGE.has(storage)) {
    return { ownershipStatus: "PHYSICAL", ownershipSource: null };
  }

  if (DIGITAL_STORAGE.has(storage)) {
    return { ownershipStatus: "DIGITAL", ownershipSource: storage };
  }

  return {};
}

function firstElement(xml: string, name: string): string {
  const element = allElements(xml, name)[0];
  if (element === undefined) throw new Error(`Missing XML element: ${name}`);
  return element;
}

function allElements(xml: string, name: string): string[] {
  const pattern = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "gi");
  return Array.from(xml.matchAll(pattern), (match) => match[1]);
}

function field(xml: string, name: string): string {
  const value = allElements(xml, name)[0];
  return value === undefined ? "" : decodeXml(value).trim();
}

function decodeXml(value: string): string {
  const withoutCdata = value.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1");
  return withoutCdata.replace(
    /&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi,
    (entity) => {
      switch (entity) {
        case "&amp;":
          return "&";
        case "&lt;":
          return "<";
        case "&gt;":
          return ">";
        case "&quot;":
          return '"';
        case "&apos;":
          return "'";

        default: {
          const codePoint = entity.startsWith("&#x")
            ? Number.parseInt(entity.slice(3, -1), 16)
            : Number.parseInt(entity.slice(2, -1), 10);
          return codePoint >= 0 && codePoint <= 0x10ffff
            ? String.fromCodePoint(codePoint)
            : entity;
        }
      }
    },
  );
}

function positiveInteger(value: string): number | null {
  const number = nonNegativeInteger(value);
  return number && number > 0 ? number : null;
}

function nonNegativeInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}
