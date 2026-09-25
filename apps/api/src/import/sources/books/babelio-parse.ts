import type { BookOwnershipStatus, BookStatus } from "@loomkeep/shared";
import { parseCsv } from "../../csv";
import { parseStarRatingToTen } from "./csv-field.util";

export interface ParsedBabelioRow {
  title: string;
  authors: string[];
  isbn: string | null;
  status: BookStatus;
  rating: number | null;
  notes: null;
  startedAt: null;
  finishedAt: null;
  ownershipStatus: BookOwnershipStatus;
  readCount: number;
}

const STATUS_BY_BABELIO_STATUS: Record<string, BookStatus> = {
  lu: "READ",
  "en cours": "READING",
  "pense-bête": "TO_READ",
  "pense-bete": "TO_READ",
  "à lire": "TO_READ",
  "a lire": "TO_READ",
  abandonné: "DROPPED",
  abandonne: "DROPPED",
};

/**
 * Parse Babelio's semicolon-delimited library export. Its status and rating
 * are useful, but it does not carry reading dates, notes, or copy format.
 */
export function parseBabelioCsv(text: string): ParsedBabelioRow[] {
  return parseCsv(text, ";")
    .filter((record) => (record["Titre"] ?? "").trim() !== "")
    .map((record) => ({
      title: record["Titre"].trim(),
      authors: splitAuthors(record["Auteur"]),
      isbn: normaliseIsbn(record["ISBN"]),
      status:
        STATUS_BY_BABELIO_STATUS[
          (record["Statut"] ?? "").trim().toLowerCase()
        ] ?? "TO_READ",
      rating: parseStarRatingToTen(record["Note"]),
      notes: null,
      startedAt: null,
      finishedAt: null,
      ownershipStatus: "NONE",
      readCount: 0,
    }));
}

function splitAuthors(value: string | undefined): string[] {
  const author = (value ?? "").trim();
  return author === "" ? [] : [author];
}

function normaliseIsbn(value: string | undefined): string | null {
  const cleaned = (value ?? "").replace(/[^\dX]/gi, "");
  return /^(\d{9}[\dX]|\d{13})$/i.test(cleaned) ? cleaned : null;
}
