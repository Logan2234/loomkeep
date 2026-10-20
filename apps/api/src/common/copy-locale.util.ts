import { Locale } from "@loomkeep/shared";

/**
 * The languages the API writes its own copy in (emails, push, notifications,
 * feeds). Adding one here makes the compiler list every copy table missing it.
 */
const COPY_LOCALES = ["fr", "en", "it"] as const;
export type CopyLocale = (typeof COPY_LOCALES)[number];

/**
 * Which copy a recipient gets: their own language when the API has it, English
 * for a locale the web ships but the API doesn't write yet, and the instance's
 * French default when the locale is missing or unknown.
 */
export function resolveCopyLocale(
  locale: string | null | undefined,
): CopyLocale {
  if (COPY_LOCALES.includes(locale as CopyLocale)) return locale as CopyLocale;
  return Locale.includes(locale as Locale) ? "en" : "fr";
}
