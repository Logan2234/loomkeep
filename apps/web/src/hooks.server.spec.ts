import type { RequestEvent } from "@sveltejs/kit";
import { describe, expect, it } from "vitest";
import { handle } from "./hooks.server";
import { getLocale } from "./lib/paraglide/runtime.js";

describe("server locale isolation", () => {
  it("renders each request in its own locale and varies caches accordingly", async () => {
    const responses = await Promise.all(
      ["fr", "en"].map(async (locale) => {
        const request = new Request("https://loomkeep.example/", {
          headers: { "accept-language": locale },
        });
        return handle({
          event: { request } as RequestEvent,
          resolve: async (_event, options) => {
            await Promise.resolve();
            const html = `<html lang="%paraglide.lang%">${getLocale()}</html>`;
            const transformed = await options!.transformPageChunk!({
              html,
              done: true,
            });
            return new Response(transformed);
          },
        });
      }),
    );
    expect(await responses[0].text()).toBe('<html lang="fr">fr</html>');
    expect(await responses[1].text()).toBe('<html lang="en">en</html>');
    expect(responses[0].headers.get("vary")).toContain("Accept-Language");
    expect(responses[0].headers.get("vary")).toContain("Cookie");
  });
});
