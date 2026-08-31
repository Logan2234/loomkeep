import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.fn().mockResolvedValue(undefined);

vi.mock("../core", () => ({ request }));

describe("typedRequest", () => {
  beforeEach(() => {
    request.mockClear();
  });

  it("interpolates path params without touching the query string", async () => {
    const { typedRequest } = await import("./typed-request");

    await typedRequest("/comments/{type}/{id}/count", {
      params: { type: "MEDIA", id: "abc def" },
    });

    expect(request).toHaveBeenCalledWith(
      "/comments/MEDIA/abc%20def/count",
      expect.objectContaining({ params: { type: "MEDIA", id: "abc def" } }),
    );
  });

  it("appends a query string built from the query option, skipping undefined values", async () => {
    const { typedRequest } = await import("./typed-request");

    await typedRequest("/catalog/search", {
      query: { q: "one piece", type: undefined, page: 2 },
    });

    const [url] = request.mock.calls[0] as [string];
    expect(url.startsWith("/catalog/search?")).toBe(true);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("q")).toBe("one piece");
    expect(params.get("page")).toBe("2");
    expect(params.has("type")).toBe(false);
  });

  it("repeats the key for an array query value instead of joining it", async () => {
    const { typedRequest } = await import("./typed-request");

    await typedRequest("/library", {
      query: { status: ["WATCHING", "PLANNED"] },
    });

    const [url] = request.mock.calls[0] as [string];
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.getAll("status")).toEqual(["WATCHING", "PLANNED"]);
  });

  it("combines interpolated path params with a query string", async () => {
    const { typedRequest } = await import("./typed-request");

    await typedRequest("/catalog/{source}/{id}/extras", {
      params: { source: "tmdb", id: "42" },
      query: { lang: "fr" },
    });

    expect(request).toHaveBeenCalledWith(
      "/catalog/tmdb/42/extras?lang=fr",
      expect.anything(),
    );
  });

  it("omits the query string entirely when no query is passed", async () => {
    const { typedRequest } = await import("./typed-request");

    await typedRequest("/notifications");

    expect(request).toHaveBeenCalledWith("/notifications", undefined);
  });

  it("forwards method/body/withAuth unchanged to request()", async () => {
    const { typedRequest } = await import("./typed-request");

    await typedRequest("/comments", {
      method: "POST",
      body: { targetType: "MEDIA", targetId: "1", text: "hi" },
    });

    expect(request).toHaveBeenCalledWith(
      "/comments",
      expect.objectContaining({
        method: "POST",
        body: { targetType: "MEDIA", targetId: "1", text: "hi" },
      }),
    );
  });
});
