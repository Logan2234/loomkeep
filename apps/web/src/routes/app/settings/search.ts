// Settings search: the answer to "where does this live?" on a surface with
// five groups and fifteen sections. It matches individual controls, not just
// section titles — someone looking for the digest hour types "fuseau", which
// is a row inside Communications and nowhere in its name.
import type { SettingsSectionDef } from "./nav";
import { SETTINGS_SECTIONS, sectionHref } from "./nav";

export interface SettingsSearchHit {
  section: SettingsSectionDef;
  /** The control that matched, or null when the section itself did. */
  entryLabel: string | null;
  /** The control's anchor, so the result lands on the row and not the page. */
  entryId: string | null;
}

/** One result group represents the page that owns its matching controls. */
export interface SettingsSearchGroup {
  section: SettingsSectionDef;
  entries: SettingsSearchHit[];
}

/**
 * Lower-cases and strips diacritics, so "confidentialite" finds
 * "Confidentialité" and "Fuseau" finds "fuseau horaire".
 */
export function fold(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function matches(haystack: string[], needle: string): boolean {
  return haystack.some((term) => fold(term).includes(needle));
}

/**
 * Sections first, then the controls inside them, so typing a section name
 * never buries it under its own rows. `visible` filters out what the
 * deployment hides (social off).
 */
export function searchSettings(
  query: string,
  sections: SettingsSectionDef[] = SETTINGS_SECTIONS,
): SettingsSearchHit[] {
  const needle = fold(query.trim());
  if (!needle) return [];

  const sectionHits: SettingsSearchHit[] = [];
  const entryHits: SettingsSearchHit[] = [];

  for (const section of sections) {
    if (matches([section.label, ...section.keywords], needle)) {
      sectionHits.push({ section, entryLabel: null, entryId: null });
    }

    for (const entry of section.entries) {
      if (matches([entry.label, ...entry.keywords], needle)) {
        entryHits.push({
          section,
          entryLabel: entry.label,
          entryId: entry.id,
        });
      }
    }
  }

  return [...sectionHits, ...entryHits];
}

/**
 * Keeps every matching control under its owning page. The page itself is the
 * heading and link for the group, even when the query only found a control.
 */
export function groupSearchHits(
  hits: SettingsSearchHit[],
): SettingsSearchGroup[] {
  const groups = new Map<string, SettingsSearchGroup>();

  for (const hit of hits) {
    let group = groups.get(hit.section.slug);

    if (!group) {
      group = { section: hit.section, entries: [] };
      groups.set(hit.section.slug, group);
    }

    if (hit.entryId) group.entries.push(hit);
  }

  return [...groups.values()];
}

/** Where a hit leads: the section, or the row inside it that matched. */
export function hitHref(hit: SettingsSearchHit): string {
  const href = sectionHref(hit.section.slug);
  return hit.entryId ? `${href}#${hit.entryId}` : href;
}
