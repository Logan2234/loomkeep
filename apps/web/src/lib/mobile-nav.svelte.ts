import { STORAGE_KEYS } from "#lib/constants/storage-keys.js";
import { readStorage, writeStorage } from "#lib/local-storage.js";
import { DEFAULT_BOTTOM_SHORTCUTS } from "#lib/navigation.js";
import {
  MOBILE_NAV_SHORTCUT_LIMITS,
  REQUIRED_SHORTCUT,
} from "@loomkeep/shared";

/** A stored list if it's still a valid bar: the defaults otherwise. */
export function parseShortcuts(stored: string | null): string[] {
  if (stored) {
    try {
      const ids: unknown = JSON.parse(stored);

      if (
        Array.isArray(ids) &&
        ids.includes(REQUIRED_SHORTCUT) &&
        ids.length >= MOBILE_NAV_SHORTCUT_LIMITS.min &&
        ids.length <= MOBILE_NAV_SHORTCUT_LIMITS.max &&
        ids.every((id) => typeof id === "string")
      ) {
        return ids as string[];
      }
    } catch {
      // Not ours to keep.
    }
  }

  return [...DEFAULT_BOTTOM_SHORTCUTS];
}

// The bottom bar's organisation belongs to each phone, not to the account.
class MobileNavState {
  shortcuts = $state<string[]>(parseShortcuts(null));

  init(): void {
    this.shortcuts = parseShortcuts(readStorage(STORAGE_KEYS.mobileNav));
  }

  save(next: string[]): void {
    this.shortcuts = next;
    writeStorage(STORAGE_KEYS.mobileNav, JSON.stringify(next));
  }
}

export const mobileNav = new MobileNavState();
