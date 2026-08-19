import { baseLocale, isLocale, type Locale } from "$lib/paraglide/runtime";

export const LANGUAGE_TO_LOCALE: Record<Locale, string> = {
  en: "en-US",
  fr: "fr-FR",
};

/**
 * Resolves an untrusted locale string (e.g. `UserDto.locale`, typed as plain
 * `string`) to its `Intl` locale code, falling back to the app's base locale
 * when the value isn't one of the known Paraglide locales.
 */
export function toIntlLocale(locale?: string): string {
  return LANGUAGE_TO_LOCALE[isLocale(locale) ? locale : baseLocale];
}
