import { Locale } from "@loomkeep/shared";

/**
 * Narrows a client-supplied `?lang=` to a locale the app actually ships.
 *
 * Unrecognized or absent → undefined, which every caller reads as "no
 * preference": a provider falls back to its own default, and collation falls
 * back to the base locale. Never pass the raw query value on — it reaches
 * `Intl` constructors and provider URLs.
 */
export function safeLang(lang: string | undefined): string | undefined {
  return Locale.includes(lang as Locale) ? lang : undefined;
}
