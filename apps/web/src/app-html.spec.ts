import { Locale, regionalLocale } from "@loomkeep/shared";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("./app.html", import.meta.url), "utf8");
// app.html has exactly one inline script, written by us: slicing between its
// tags is enough, no HTML parsing involved.
const scriptTag = '<script nonce="%sveltekit.nonce%">';
const scriptStart = html.indexOf(scriptTag) + scriptTag.length;
const bootScript = html.slice(
  scriptStart,
  html.indexOf("</script>", scriptStart),
);

/** Runs app.html's pre-paint script against a minimal browser stand-in. */
function boot({
  cookie = "",
  languages,
}: {
  cookie?: string;
  languages: string[];
}) {
  const root = { lang: "", classList: { add: () => {} } };
  const manifest = { href: "" };
  const themeColor = { content: "" };
  runInNewContext(bootScript, {
    document: {
      cookie,
      documentElement: root,
      querySelector: (selector: string) =>
        selector.includes("manifest") ? manifest : themeColor,
    },
    navigator: { languages, language: languages[0] },
    localStorage: { getItem: () => null },
    matchMedia: () => ({ matches: false }),
  });
  return { lang: root.lang, manifest: manifest.href };
}

describe("app.html boot script", () => {
  it.each(Locale)("keeps a %s locale cookie", (locale) => {
    const result = boot({
      cookie: `PARAGLIDE_LOCALE=${locale}`,
      languages: ["en-US"],
    });

    expect(result.lang).toBe(regionalLocale(locale));
    expect(result.manifest).toBe(`/manifest.webmanifest?lang=${locale}`);
  });

  it.each(Locale)("picks %s from the browser languages", (locale) => {
    const result = boot({ languages: [`${locale}-XX`, "en"] });

    expect(result.lang).toBe(regionalLocale(locale));
  });

  it("falls back to English for a language Loomkeep doesn't ship", () => {
    expect(boot({ languages: ["de-DE"] }).lang).toBe("en-US");
  });
});
