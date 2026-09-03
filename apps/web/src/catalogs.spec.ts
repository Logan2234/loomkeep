import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "svelte/compiler";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const locales = ["fr", "en"] as const;
const names = ["common", "other", "errors", "gamification"] as const;
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
        for (const key of rawKeys)
          expect(key.startsWith("common_"), key).toBe(name === "common");
        for (const value of Object.values(messages))
          expect(typeof value).toBe("string");
        keys.push(...rawKeys);
      }

      expect(keys.length).toBe(new Set(keys).size);
    },
  );

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

  it("does not duplicate generic common messages in other", () => {
    const pairs = new Map(
      Object.entries(catalogs.fr.common.messages).map(([key, fr]) => [
        JSON.stringify([fr, catalogs.en.common.messages[key]]),
        key,
      ]),
    );
    expect(pairs.size, "duplicate generic messages within common").toBe(
      Object.keys(catalogs.fr.common.messages).length,
    );
    const duplicates = Object.entries(catalogs.fr.other.messages).flatMap(
      ([key, fr]) => {
        const commonKey = pairs.get(
          JSON.stringify([fr, catalogs.en.other.messages[key]]),
        );
        return commonKey ? [`${key} duplicates ${commonKey}`] : [];
      },
    );
    expect(duplicates).toEqual([]);
  });

  it("keeps reusable interface labels in common", () => {
    for (const locale of locales) {
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
        "common_category",
        "common_action",
        "common_more_actions",
        "common_albums",
        "common_domain",
        "common_domains",
        "common_items",
        "common_works",
        "common_birthdate",
        "common_size",
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
    expect(catalogs.fr.other.messages.library_status_completed).toBe("Terminé");
    expect(catalogs.en.other.messages.library_status_completed).toBe(
      "Completed",
    );
  });

  it("resolves message calls throughout the frontend after key renames", () => {
    const directory = fileURLToPath(new URL("./", import.meta.url));
    const keys = new Set(
      names.flatMap((name) => Object.keys(catalogs.en[name].messages)),
    );
    const missing: string[] = [];

    for (const file of readdirSync(directory, {
      recursive: true,
      encoding: "utf8",
    })) {
      const path = file.replaceAll("\\", "/");
      if (
        !/\.(ts|svelte)$/.test(path) ||
        path.includes("paraglide/") ||
        path.endsWith(".spec.ts")
      )
        continue;
      const source = readFileSync(new URL(path, import.meta.url), "utf8");

      const checkKey = (key: string) => {
        if (!keys.has(key)) missing.push(`${path}: ${key}`);
      };

      if (path.endsWith(".svelte")) {
        const visit = (value: unknown) => {
          if (!value || typeof value !== "object") return;
          if (Array.isArray(value)) return value.forEach(visit);
          const node = value as Record<string, unknown>;
          const callee = node.callee as
            | {
                type: string;
                computed?: boolean;
                object?: { type: string; name: string };
                property?: { name: string };
              }
            | undefined;

          if (
            node.type === "CallExpression" &&
            callee?.type === "MemberExpression" &&
            !callee.computed &&
            callee.object?.type === "Identifier" &&
            callee.object.name === "m" &&
            callee.property
          ) {
            checkKey(callee.property.name);
          }

          for (const [key, child] of Object.entries(node)) {
            if (key !== "metadata" && key !== "loc") visit(child);
          }
        };

        visit(parse(source, { modern: true }));
      } else {
        const visit = (node: ts.Node) => {
          if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.expression) &&
            node.expression.expression.text === "m"
          ) {
            checkKey(node.expression.name.text);
          }

          ts.forEachChild(node, visit);
        };

        visit(ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true));
      }
    }

    expect(missing).toEqual([]);
  });
});
