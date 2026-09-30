import { locales } from "$lib/paraglide/runtime";

/** A language named in itself ("Español"), so its speakers find it from any UI language. */
export function languageName(locale: string): string {
  const name =
    new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

/** Every shipped locale, named in itself. */
export function languageOptions(): {
  label: string;
  value: (typeof locales)[number];
}[] {
  return locales.map((locale) => ({
    value: locale,
    label: languageName(locale),
  }));
}
