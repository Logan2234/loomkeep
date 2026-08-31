import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { extractLocaleFromRequest } from "./lib/paraglide/runtime.js";

describe("first-visit locale", () => {
  it.each([
    ["en-GB,en;q=0.9,fr;q=0.5", "", "en"],
    ["fr-CA,fr;q=0.9,en;q=0.5", "", "fr"],
    ["de-DE,fr;q=0.8,en;q=0.5", "", "fr"],
    ["en-US", "PARAGLIDE_LOCALE=fr", "fr"],
    ["fr-FR", "PARAGLIDE_LOCALE=en", "en"],
    ["de-DE,es;q=0.8", "", "en"],
    ["", "", "en"],
  ])("negotiates %s with cookie %s", (languages, cookie, expected) => {
    const request = new Request("https://loomkeep.example/app", {
      headers: { "accept-language": languages, cookie },
    });
    expect(extractLocaleFromRequest(request)).toBe(expected);
  });

  it.each([
    [["en-GB", "fr"], "", "en-US"],
    [["de-DE", "en-US"], "", "en-US"],
    [["en-US"], "PARAGLIDE_LOCALE=fr", "fr-FR"],
    [["fr-CA"], "PARAGLIDE_LOCALE=en", "en-US"],
    [["en-US"], "PARAGLIDE_LOCALE=invalid", "en-US"],
    [["de-DE", "es"], "", "en-US"],
  ])(
    "sets the document language before first paint",
    (languages, cookie, expected) => {
      const template = readFileSync(
        new URL("./app.html", import.meta.url),
        "utf8",
      );
      const script = template.match(/<script>([\s\S]*?)<\/script>/)![1];
      const manifest = { href: "/manifest.webmanifest" };
      const document = {
        cookie,
        documentElement: { lang: "fr-FR", classList: { add() {} } },
        querySelector: () => manifest,
      };
      runInNewContext(script, {
        document,
        navigator: { languages, language: languages[0] },
        localStorage: { getItem: () => "light" },
        matchMedia: () => ({ matches: false }),
      });
      expect(document.documentElement.lang).toBe(expected);
      expect(manifest.href).toBe(
        `/manifest.webmanifest?lang=${expected.slice(0, 2)}`,
      );
    },
  );
});
