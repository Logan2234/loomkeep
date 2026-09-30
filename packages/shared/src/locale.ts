import { Locale } from "./enums";

// The region each locale formats dates and numbers with, and asks TMDB for.
// A locale missing here uses its bare code ("it"), which both accept.
const LOCALE_REGIONS: Partial<Record<Locale, string>> = {
  fr: "fr-FR",
  en: "en-US",
  it: "it-IT",
};

/** "fr" → "fr-FR"; no locale, or one Loomkeep doesn't ship → "en-US". */
export function regionalLocale(locale: string | null | undefined): string {
  if (!Locale.includes(locale as Locale)) return "en-US";
  return LOCALE_REGIONS[locale as Locale] ?? (locale as string);
}
