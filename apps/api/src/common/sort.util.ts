/** Epoch milliseconds for an optional ISO date, 0 when absent — sorts unset values last under a descending comparator. */
export function timeMs(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

const DEFAULT_COLLATION_LOCALE = "en";
const collators = new Map<string, Intl.Collator>();

/**
 * Alphabetical comparison of two titles under the viewer's own locale.
 *
 * Collation is language-dependent — a French reader expects "École" next to
 * "Ecole", a Swedish one expects "Ä" after "Z" — so the locale can't be
 * hardcoded, which it was (`"fr"`, in all four library services, whatever the
 * account's language).
 *
 * Goes through a cached `Intl.Collator` rather than `String.localeCompare`:
 * the library list sorts every entry the user owns on each request (see
 * `listEntries`), and localeCompare builds a fresh collator on every single
 * comparison.
 */
export function compareTitles(a: string, b: string, locale?: string): number {
  return collatorFor(locale ?? DEFAULT_COLLATION_LOCALE).compare(a, b);
}

function collatorFor(locale: string): Intl.Collator {
  let collator = collators.get(locale);

  if (!collator) {
    // `numeric` so "Saison 2" precedes "Saison 10"; `base` sensitivity so
    // case and accents don't split otherwise-identical titles apart.
    collator = new Intl.Collator(locale, {
      numeric: true,
      sensitivity: "base",
    });
    collators.set(locale, collator);
  }

  return collator;
}
