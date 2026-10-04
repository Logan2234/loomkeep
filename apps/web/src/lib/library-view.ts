import type {
  BulkEntriesResultDto,
  BulkEntriesTargetDto,
  BulkUpdateEntriesDto,
  ReviewTargetType,
  SavedViewDomain,
} from "@loomkeep/shared";
import { joinMeta } from "./format";

export const LIBRARY_VIEW_MODES = [
  "cards",
  "table",
  "wall",
  "compact",
] as const;
export type LibraryViewMode = (typeof LIBRARY_VIEW_MODES)[number];

// One key per library, and per device rather than per account: the table
// can suit the desktop while the cards stay on the phone.
const storageKey = (domain: SavedViewDomain) =>
  `lk-library-view-${domain.toLowerCase()}`;

function isViewMode(value: string | null): value is LibraryViewMode {
  return LIBRARY_VIEW_MODES.some((mode) => mode === value);
}

export function readLibraryViewMode(domain: SavedViewDomain): LibraryViewMode {
  try {
    const stored = localStorage.getItem(storageKey(domain));
    return isViewMode(stored) ? stored : "cards";
  } catch {
    return "cards";
  }
}

export function writeLibraryViewMode(
  domain: SavedViewDomain,
  mode: LibraryViewMode,
): void {
  try {
    localStorage.setItem(storageKey(domain), mode);
  } catch {
    // Private browsing or blocked storage: the mode just won't be remembered.
  }
}

const columnsKey = (domain: SavedViewDomain) =>
  `lk-library-columns-${domain.toLowerCase()}`;

/** The table's visible column keys, or null when never customised (or unreadable). */
export function readLibraryColumns(domain: SavedViewDomain): string[] | null {
  try {
    const stored = JSON.parse(
      localStorage.getItem(columnsKey(domain)) ?? "null",
    );
    return Array.isArray(stored) &&
      stored.every((key) => typeof key === "string")
      ? stored
      : null;
  } catch {
    return null;
  }
}

/** Null forgets the choice, back to the library's default columns. */
export function writeLibraryColumns(
  domain: SavedViewDomain,
  keys: string[] | null,
): void {
  try {
    if (keys) localStorage.setItem(columnsKey(domain), JSON.stringify(keys));
    else localStorage.removeItem(columnsKey(domain));
  } catch {
    // Private browsing or blocked storage: the choice just won't be remembered.
  }
}

/** What the table, compact and wall modes show of an entry, whatever its domain. */
export interface LibraryItemView {
  upcoming?: boolean;
  /** An unreleased game: its status and ownership wait for the release. */
  trackingLocked?: boolean;
  href: string;
  title: string;
  /** Type, authors or artists, shown under the title. */
  subtitle: string | null;
  imageUrl: string | null;
  status: { value: string; label: string; cls: string };
  /** The ownership status value ("NONE" when unset), for its inline menu. */
  ownership: string;
  ownershipSource: string | null;
  /** Where the entry's review lives: the rating is edited through it. */
  reviewTarget: { type: ReviewTargetType; id: string };
  rating: number | null;
  favorite: boolean;
  progress: {
    percent: number;
    label: string;
    paused: boolean;
    /** Paused for so long it's a ghost — media only. */
    ghost?: boolean;
  } | null;
}

/**
 * A table column. `sort` is the library sort it drives from its header;
 * `defaultHidden` leaves it out until picked in the display menu.
 */
export type LibraryColumn<T> = {
  key: string;
  label: string;
  sort?: string;
  numeric?: boolean;
  defaultHidden?: boolean;
} & (
  | { kind: "title" | "status" | "progress" | "rating" }
  | {
      kind: "text";
      value: (entry: T) => string | null;
      /** Long free text (notes): cut to one line. */
      truncate?: boolean;
      /** Editable in place through the ownership menu. */
      ownership?: boolean;
    }
);

/** "Streaming · Netflix" for the ownership column, null when unset. */
export function ownershipText(
  options: { value: string; label: string }[],
  status: string,
  source: string | null,
): string | null {
  if (status === "NONE") return null;
  const label = options.find((o) => o.value === status)?.label ?? status;
  return joinMeta(label, source);
}

/** Selection mode (UX-04), as each display mode renders it. */
export interface LibrarySelection<T> {
  active: boolean;
  has: (entry: T) => boolean;
  /** `range` (Shift) also selects everything since the last toggled entry. */
  toggle: (entry: T, range: boolean) => void;
  /** Every loaded entry is selected (the table header's checkbox). */
  allLoaded: boolean;
  someLoaded: boolean;
  toggleLoaded: () => void;
}

/** A library's bulk actions, wired to its domain's endpoints. */
export interface LibraryBulkActions {
  statusOptions: { label: string; value: string }[];
  ownershipOptions: { label: string; value: string }[];
  /** Presets offered in a submenu of their ownership status. */
  ownershipSources: Record<string, string[]>;
  update: (dto: BulkUpdateEntriesDto) => Promise<BulkEntriesResultDto>;
  remove: (target: BulkEntriesTargetDto) => Promise<BulkEntriesResultDto>;
}

/** In-place editing of a table row (desktop only, outside selection mode). */
export interface LibraryInlineEdit<T> {
  statusOptions: { label: string; value: string }[];
  ownershipOptions: { label: string; value: string }[];
  ownershipSources: Record<string, string[]>;
  save: (
    entry: T,
    action: {
      status?: string;
      ownershipStatus?: string;
      ownershipSource?: string | null;
    },
  ) => void;
  /** The cell that just saved, to acknowledge it in place. */
  saved: { key: string; field: "status" | "ownership" } | null;
  /** Opens the entry's review, where its rating lives. */
  review: (entry: T) => void;
}
