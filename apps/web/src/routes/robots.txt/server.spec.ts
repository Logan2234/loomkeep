import * as env from "$app/env/public";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./+server";

vi.mock("$app/env/public", () => ({ PUBLIC_SEARCH_INDEXING: undefined }));

async function robots() {
  const response = await GET({
    url: new URL("https://tracker.example.org/robots.txt"),
    setHeaders: () => {},
  } as unknown as Parameters<typeof GET>[0]);
  return response.text();
}

describe("GET /robots.txt", () => {
  afterEach(() => {
    vi.mocked(env).PUBLIC_SEARCH_INDEXING = undefined;
  });

  // A self-hosted instance would otherwise put its copy of the landing page,
  // and its address, in search results.
  it("keeps every crawler out unless indexing is switched on", async () => {
    const body = await robots();

    expect(body).toContain("User-agent: *\nDisallow: /\n");
    expect(body).not.toContain("Sitemap:");
  });

  it("opens the public pages and names the sitemap when switched on", async () => {
    vi.mocked(env).PUBLIC_SEARCH_INDEXING = "true";

    const body = await robots();

    expect(body).not.toMatch(/^Disallow: \/$/m);
    expect(body).toContain("Disallow: /app/");
    expect(body).toContain("Sitemap: https://tracker.example.org/sitemap.xml");
  });
});
