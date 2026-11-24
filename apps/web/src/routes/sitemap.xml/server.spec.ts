import { describe, expect, it } from "vitest";
import { GET, _PUBLIC_PATHS } from "./+server";

async function sitemap() {
  const response = await GET({
    url: new URL("https://tracker.example.org/sitemap.xml"),
    setHeaders: () => {},
  } as unknown as Parameters<typeof GET>[0]);
  return response.text();
}

describe("GET /sitemap.xml", () => {
  it("spells out every public page on the origin it was reached on", async () => {
    const body = await sitemap();

    for (const { path } of _PUBLIC_PATHS) {
      expect(body).toContain(`<loc>https://tracker.example.org${path}</loc>`);
    }
  });

  // A malformed date makes Google drop the field for the whole file.
  it("gives each page a W3C date as lastmod", async () => {
    const body = await sitemap();

    const dates = [...body.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)];
    expect(dates).toHaveLength(_PUBLIC_PATHS.length);

    for (const [, date] of dates) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(date))).toBe(false);
    }
  });
});
