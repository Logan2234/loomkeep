import { STORAGE_KEYS } from "#lib/constants/storage-keys.js";
import { readStorage, writeStorage } from "#lib/local-storage.js";
import {
  DEFAULT_BOTTOM_SHORTCUTS,
  isBottomShortcutChoice,
} from "#lib/navigation.js";
import { MOBILE_NAV_SHORTCUT_LIMITS } from "@loomkeep/shared";

// What's stored is the bar without Library, which is always there, at the
// centre: its limits count it.
const MIN_OTHERS = MOBILE_NAV_SHORTCUT_LIMITS.min - 1;
const MAX_OTHERS = MOBILE_NAV_SHORTCUT_LIMITS.max - 1;

// A bar saved before the Library tab always carried "menu".
const LEGACY_LAUNCHER = "menu";

/** A stored list if it's still a valid bar: the defaults otherwise. */
export function parseShortcuts(stored: string | null): string[] {
  let ids: unknown = null;

  try {
    ids = stored ? JSON.parse(stored) : null;
  } catch {
    // Not ours to keep.
  }

  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
    return [...DEFAULT_BOTTOM_SHORTCUTS];
  }

  if (ids.includes(LEGACY_LAUNCHER)) return migrateLegacy(ids);

  const valid =
    new Set(ids).size === ids.length &&
    ids.every(isBottomShortcutChoice) &&
    ids.length >= MIN_OTHERS &&
    ids.length <= MAX_OTHERS;
  return valid ? ids : [...DEFAULT_BOTTOM_SHORTCUTS];
}

// Menu, Messages, Alerts and the domains left the bar's choices: the tabs
// they held go to the defaults, so an old bar keeps its size.
function migrateLegacy(ids: string[]): string[] {
  const others = ids.filter((id) => id !== LEGACY_LAUNCHER);
  const kept = [...new Set(others.filter(isBottomShortcutChoice))];
  const size = Math.min(MAX_OTHERS, Math.max(MIN_OTHERS, others.length));

  for (const id of DEFAULT_BOTTOM_SHORTCUTS) {
    if (kept.length >= size) break;
    if (!kept.includes(id)) kept.push(id);
  }

  return kept;
}

/** Where the Messages and Alerts edge tab sits: a side, and its centre as a share of the screen's height. */
export interface EdgeTabPlace {
  side: "left" | "right";
  y: number;
}

/** On the right, a third of the way up: under the thumb. */
export const DEFAULT_EDGE_TAB: EdgeTabPlace = { side: "right", y: 2 / 3 };
export const EDGE_TAB_Y = { min: 0.12, max: 0.8 } as const;

export function parseEdgeTabPlace(stored: string | null): EdgeTabPlace {
  try {
    const place: unknown = stored ? JSON.parse(stored) : null;

    if (
      place &&
      typeof place === "object" &&
      "side" in place &&
      "y" in place &&
      (place.side === "left" || place.side === "right") &&
      typeof place.y === "number" &&
      place.y >= EDGE_TAB_Y.min &&
      place.y <= EDGE_TAB_Y.max
    ) {
      return { side: place.side, y: place.y };
    }
  } catch {
    // Not ours to keep.
  }

  return { ...DEFAULT_EDGE_TAB };
}

// The bottom bar's organisation belongs to each phone, not to the account.
class MobileNavState {
  shortcuts = $state<string[]>(parseShortcuts(null));
  edgeTab = $state<EdgeTabPlace>({ ...DEFAULT_EDGE_TAB });

  init(): void {
    this.shortcuts = parseShortcuts(readStorage(STORAGE_KEYS.mobileNav));
    this.edgeTab = parseEdgeTabPlace(readStorage(STORAGE_KEYS.edgeTab));
  }

  save(next: string[]): void {
    this.shortcuts = next;
    writeStorage(STORAGE_KEYS.mobileNav, JSON.stringify(next));
  }

  placeEdgeTab(place: EdgeTabPlace): void {
    this.edgeTab = place;
    writeStorage(STORAGE_KEYS.edgeTab, JSON.stringify(place));
  }
}

export const mobileNav = new MobileNavState();
