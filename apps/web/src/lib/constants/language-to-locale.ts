import { baseLocale, isLocale } from "$lib/paraglide/runtime";
import type { Locale } from "@loomkeep/shared";

const LANGUAGE_TO_LOCALE = {
  en: "en-US",
  fr: "fr-FR",
} as const;

/**
 * Resolves an untrusted locale string (e.g. `UserDto.locale`, typed as plain
 * `string`) to its `Intl` locale code, falling back to the app's base locale
 * when the value isn't one of the known Paraglide locales.
 */
export const toIntlLocale = (locale?: Locale) =>
  LANGUAGE_TO_LOCALE[isLocale(locale) ? locale : baseLocale];
