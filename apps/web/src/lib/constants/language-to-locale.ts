import { baseLocale, isLocale } from "$lib/paraglide/runtime";
import type { Locale } from "@loomkeep/shared";

const LANGUAGE_TO_LOCALE = {
  en: "en-US",
  fr: "fr-FR",
} as const;

export const toIntlLocale = (locale?: Locale) =>
  LANGUAGE_TO_LOCALE[isLocale(locale) ? locale : baseLocale];
