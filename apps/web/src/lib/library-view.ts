import type {
  BulkEntriesResultDto,
  BulkEntriesTargetDto,
  BulkUpdateEntriesDto,
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

/** What the table, compact and wall modes show of an entry, whatever its domain. */
export interface LibraryItemView {
  href: string;
  title: string;
  /** Type, authors or artists, shown under the title. */
  subtitle: string | null;
  imageUrl: string | null;
  status: { label: string; cls: string };
  rating: number | null;
  favorite: boolean;
  onToggleFavorite: (next: boolean) => void;
  progress: { percent: number; label: string; paused: boolean } | null;
}

/** A table column. `sort` is the library sort it drives from its header. */
export type LibraryColumn<T> = {
  label: string;
  sort?: string;
  numeric?: boolean;
} & (
  | { kind: "title" | "status" | "progress" | "rating" }
  | { kind: "text"; value: (entry: T) => string | null }
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
  update: (dto: BulkUpdateEntriesDto) => Promise<BulkEntriesResultDto>;
  remove: (target: BulkEntriesTargetDto) => Promise<BulkEntriesResultDto>;
}
