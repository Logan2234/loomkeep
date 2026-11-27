import { Locale } from "@loomkeep/shared/catalog";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const settings: { baseLocale: string; locales: string[] } = JSON.parse(
  readFileSync(
    new URL("../project.inlang/settings.json", import.meta.url),
    "utf8",
  ),
);
// fr and en are written with every change; any other locale is translated
// afterwards and may lag behind, falling back to English key by key —
// checked here as soon as its folder exists, before it ships.
const locales = readdirSync(new URL("../messages", import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const names = [
  "common",
  "other",
  "works",
  "library",
  "social",
  "home",
  "auth",
  "errors",
  "gamification",
  "admin",
  "settings",
  "site",
] as const;
// A key with one of these prefixes lives in that file and nowhere else.
const prefixHomes: [string, (typeof names)[number]][] = [
  ["common_", "common"],
  ["settings_", "settings"],
  ["landing_", "site"],
  ["transparency_", "site"],
  ["accessibility_", "site"],
  ["gamification_", "gamification"],
  ["admin_", "admin"],
  ["media_", "works"],
  ["game_", "works"],
  ["book_", "works"],
  ["music_", "works"],
  ["work_", "works"],
  ["creator_", "works"],
  ["ownership_", "works"],
  ["tracking_", "works"],
  ["library_", "library"],
  ["session_", "library"],
  ["reading_", "library"],
  ["pile_", "library"],
  ["saved_", "library"],
  ["quick_", "library"],
  ["add_", "library"],
  ["scan_", "library"],
  ["calendar_", "library"],
  ["import_", "library"],
  ["chat_", "social"],
  ["report_", "social"],
  ["reviews_", "social"],
  ["profile_", "social"],
  ["list_", "social"],
  ["lists_", "social"],
  ["comment_", "social"],
  ["comments_", "social"],
  ["share_", "social"],
  ["activity_", "social"],
  ["home_", "home"],
  ["stats_", "home"],
  ["onboarding_", "home"],
  ["notif_", "home"],
  ["news_", "home"],
  ["auth_", "auth"],
  ["reauth_", "auth"],
  ["password_", "auth"],
];
const catalogs = Object.fromEntries(
  locales.map((locale) => [
    locale,
    Object.fromEntries(
      names.map((name) => {
        const raw = readFileSync(
          new URL(`../messages/${locale}/${name}.json`, import.meta.url),
          "utf8",
        );
        const messages: Record<string, string> = JSON.parse(raw);
        delete messages.$schema;
        return [name, { raw, messages }];
      }),
    ),
  ]),
);

describe("message catalogs", () => {
  it.each(locales)(
    "keeps %s identifiers unique within and across catalogs",
    (locale) => {
      const keys: string[] = [];

      for (const name of names) {
        const { raw, messages } = catalogs[locale][name];
        // These catalogs are flat string maps. Inspect the raw keys because
        // JSON.parse silently discards earlier definitions of duplicate keys.
        const rawKeys = [...raw.matchAll(/^\s*"([^"\n]+)"\s*:/gm)]
          .map((match) => match[1])
          .filter((key) => key !== "$schema");
        expect(rawKeys.length, name).toBe(new Set(rawKeys).size);

        for (const key of rawKeys) {
          expect(key.startsWith("common_"), key).toBe(name === "common");
          const home = prefixHomes.find(([prefix]) => key.startsWith(prefix));
          if (home) expect(name, key).toBe(home[1]);
        }

        for (const value of Object.values(messages))
          expect(typeof value).toBe("string");
        keys.push(...rawKeys);
      }

      expect(keys.length).toBe(new Set(keys).size);
    },
  );

  it("ships the same locales in Paraglide and in the shared Locale list", () => {
    expect([...settings.locales].sort()).toEqual([...Locale].sort());
    for (const locale of settings.locales) expect(locales).toContain(locale);
    expect(settings.baseLocale).toBe("en");
  });

  it("translates only English keys, with their parameters, in other locales", () => {
    const parameters = (message: string) =>
      [...new Set(message.match(/\{\w+\}/g) ?? [])].sort();

    for (const locale of locales) {
      for (const name of names) {
        const en = catalogs.en[name].messages;

        for (const [key, message] of Object.entries(
          catalogs[locale][name].messages,
        )) {
          expect(en[key], `${locale}/${name}: ${key}`).toBeTypeOf("string");
          if (message.trim())
            expect(parameters(message), `${locale}: ${key}`).toEqual(
              parameters(en[key]),
            );
        }
      }
    }
  });

  it("keeps the same keys and parameters in both locales and files", () => {
    const parameters = (message: string) =>
      [...new Set(message.match(/\{\w+\}/g) ?? [])].sort();

    for (const name of names) {
      const fr = catalogs.fr[name].messages;
      const en = catalogs.en[name].messages;
      expect(Object.keys(fr).sort(), name).toEqual(Object.keys(en).sort());

      for (const key of Object.keys(fr)) {
        expect(parameters(fr[key]), key).toEqual(parameters(en[key]));
      }
    }
  });

  it("does not duplicate generic common messages in other catalogs", () => {
    const pairs = new Map(
      Object.entries(catalogs.fr.common.messages).map(([key, fr]) => [
        JSON.stringify([fr, catalogs.en.common.messages[key]]),
        key,
      ]),
    );
    expect(pairs.size, "duplicate generic messages within common").toBe(
      Object.keys(catalogs.fr.common.messages).length,
    );
    const duplicates = names
      .filter((name) => name !== "common")
      .flatMap((name) =>
        Object.entries(catalogs.fr[name].messages).flatMap(([key, fr]) => {
          const commonKey = pairs.get(
            JSON.stringify([fr, catalogs.en[name].messages[key]]),
          );
          return commonKey ? [`${key} duplicates ${commonKey}`] : [];
        }),
      );
    expect(duplicates).toEqual([]);
  });

  it("keeps reusable interface labels in common", () => {
    for (const locale of ["fr", "en"]) {
      const common = catalogs[locale].common.messages;

      for (const key of [
        "common_links",
        "common_detail",
        "common_lists",
        "common_view_all",
        "common_copy_link",
        "common_link_copied",
        "common_learn_more",
        "common_type",
        "common_visibility",
        "common_action",
        "common_more_actions",
        "common_albums",
        "common_domain",
        "common_domains",
        "common_items",
        "common_works",
        "common_birthdate",
        "common_users",
        "common_theme",
        "common_timezone",
        "common_notifications",
        "common_push_notifications",
        "common_comments",
        "common_social",
        "common_newsletter",
        "common_current_password",
        "common_activity_feed",
      ]) {
        expect(common[key], `${locale}: ${key}`).toBeTypeOf("string");
      }
    }
  });

  it("distinguishes the finish action from a completed status", () => {
    expect(catalogs.fr.common.messages.common_finish).toBe("Terminer");
    expect(catalogs.en.common.messages.common_finish).toBe("Finish");
    expect(catalogs.fr.library.messages.library_status_completed).toBe(
      "Terminé",
    );
    expect(catalogs.en.library.messages.library_status_completed).toBe(
      "Completed",
    );
  });

  // Unknown keys are type errors (svelte-check); unused ones are not.
  // no-dynamic-message-access (ESLint) keeps every reference a static
  // `m.key`, which a plain text scan can find. The one exception is
  // achievement-labels.ts, which builds gamification_<key>_name/_description
  // from the API's achievement keys.
  it("uses every message", () => {
    let source = "";

    for (const file of readdirSync(new URL("./", import.meta.url), {
      recursive: true,
      encoding: "utf8",
    })) {
      const path = file.replaceAll("\\", "/");
      if (
        /\.(ts|svelte)$/.test(path) &&
        !path.includes("paraglide/") &&
        !path.endsWith(".spec.ts")
      )
        source += readFileSync(new URL(path, import.meta.url), "utf8");
    }

    const used = new Set(
      Array.from(source.matchAll(/\bm\.(\w+)/g), ([, key]) => key),
    );
    const dynamic = /^gamification_\w+_(name|description)$/;

    const unused = names.flatMap((name) =>
      Object.keys(catalogs.en[name].messages)
        .filter((key) => !used.has(key) && !dynamic.test(key))
        .map((key) => `${name}: ${key}`),
    );

    expect(unused).toEqual([]);
  });
});
