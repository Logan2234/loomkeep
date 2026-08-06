import type { BookOwnershipStatus, BookStatus } from "@loomkeep/shared";
import { parseCsv } from "../../csv";
import { parseReadCount, parseStarRatingToTen } from "./csv-field.util";

/** One Goodreads CSV row reduced to the fields the import needs. */
export interface ParsedGoodreadsRow {
  title: string;
  authors: string[];
  /** ISBN-10/13 when the row carries one; null otherwise. */
  isbn: string | null;
  status: BookStatus;
  /** 0–10 (Goodreads' 0–5 stars doubled); null when unrated (0). */
  rating: number | null;
  /** "Private Notes" + "My Review" (both when present); null when both empty. */
  notes: string | null;
  /** Goodreads' export has no "date started" column. */
  startedAt: null;
  finishedAt: string | null;
  /** Derived from "Binding"; NONE when it names no known format. */
  ownershipStatus: BookOwnershipStatus;
  /** Goodreads "Read Count" — total completions, including the first. */
  readCount: number;
}

// Goodreads' default shelves; a custom shelf falls back to TO_READ.
const STATUS_BY_SHELF: Record<string, BookStatus> = {
  read: "READ",
  "to-read": "TO_READ",
  "currently-reading": "READING",
};

/**
 * Parse a Goodreads library export CSV into normalised rows. Rows without a
 * title are skipped; an unknown "Exclusive Shelf" falls back to TO_READ so
 * nothing is lost.
 */
export function parseGoodreadsCsv(text: string): ParsedGoodreadsRow[] {
  return parseCsv(text)
    .filter((record) => (record["Title"] ?? "").trim() !== "")
    .map((record) => ({
      title: record["Title"].trim(),
      authors: splitAuthors(record["Author"], record["Additional Authors"]),
      isbn: normaliseIsbn(record["ISBN13"]) ?? normaliseIsbn(record["ISBN"]),
      status: parseStatus(record["Exclusive Shelf"], record["Bookshelves"]),
      rating: parseStarRatingToTen(record["My Rating"]),
      notes: combineNotes(record["Private Notes"], record["My Review"]),
      startedAt: null,
      finishedAt: toIso(record["Date Read"]),
      ownershipStatus: parseOwnership(record["Binding"]),
      readCount: parseReadCount(record["Read Count"]),
    }));
}

/**
 * Goodreads always files a book under one of its 3 built-in exclusive
 * shelves — there is no official "did not finish" shelf, so people track
 * that by additionally tagging the book with a custom shelf (seen in the
 * wild: "abandoned", "dnf") while "Exclusive Shelf" stays "read". That
 * custom tag is a stronger, deliberate signal than the exclusive shelf, so
 * it wins.
 */
function parseStatus(
  exclusiveShelf: string | undefined,
  bookshelves: string | undefined,
): BookStatus {
  if (/\b(abandoned|dnf|did-?not-?finish)\b/i.test(bookshelves ?? "")) {
    return "DROPPED";
  }

  return STATUS_BY_SHELF[(exclusiveShelf ?? "").trim()] ?? "TO_READ";
}

/**
 * "Owned Copies" turns out to be essentially never filled in (0 across a
 * real 1118-book export, including plenty of ebooks/hardcovers the user
 * clearly owns) — it's not a usable owned/not-owned signal, unlike
 * StoryGraph's explicit "Owned?" field. "Binding" (paperback/hardcover/
 * Kindle Edition/Audiobook…) is filled far more reliably, so ownership is
 * derived from it alone: a recorded binding is treated as an owned/accessed
 * copy.
 */
function parseOwnership(binding: string | undefined): BookOwnershipStatus {
  const value = (binding ?? "").trim().toLowerCase();
  if (value.includes("audio")) return "AUDIO";
  if (value.includes("kindle") || value.includes("ebook")) return "DIGITAL";

  if (value.includes("paperback") || value.includes("hardcover")) {
    return "PHYSICAL";
  }

  return "NONE";
}

/**
 * "Private Notes" is the closer match to our entry's private `notes` field;
 * "My Review" is a public review. Combine when both are present rather than
 * picking one — a real export can have either, and neither should be lost.
 */
function combineNotes(
  privateNotes: string | undefined,
  review: string | undefined,
): string | null {
  const parts = [privateNotes, review]
    .map((v) => (v ?? "").trim())
    .filter((v) => v !== "");
  return parts.length > 0 ? parts.join("\n\n") : null;
}

/** Goodreads splits "Author" (primary) from "Additional Authors" (", "-joined). */
function splitAuthors(
  primary: string | undefined,
  additional: string | undefined,
): string[] {
  const names = [
    ...(primary ? [primary] : []),
    ...(additional ? additional.split(",") : []),
  ]
    .map((name) => name.trim())
    .filter((name) => name !== "");
  return Array.from(new Set(names));
}

/**
 * Goodreads wraps ISBN/ISBN13 as `="9780261102217"` (an Excel text-formula
 * escape, to stop Excel from stripping leading zeros / going numeric). Strip
 * the leading `=` and quotes, then keep only a well-formed ISBN-10/13.
 */
function normaliseIsbn(value: string | undefined): string | null {
  const cleaned = (value ?? "").replace(/^=/, "").replace(/["\s-]/g, "");
  return /^(\d{9}[\dX]|\d{13})$/.test(cleaned) ? cleaned : null;
}

/**
 * Goodreads' "Date Read" is NOT consistently zero-padded "YYYY/MM/DD" — a
 * real export mixes "2019/07/06", "1/1/2018", "12/26/2018", "7/15/2020"…
 * (year-first, slash-separated, but month/day may be 1 or 2 digits) and even
 * "M/D/YYYY" (day-last). Accept both digit-count and field-order variants;
 * unparseable → null.
 */
function toIso(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();

  const yearFirst = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (yearFirst) return toDateIso(yearFirst[1], yearFirst[2], yearFirst[3]);

  const yearLast = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (yearLast) return toDateIso(yearLast[3], yearLast[1], yearLast[2]);

  return null;
}

function toDateIso(year: string, month: string, day: string): string | null {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
