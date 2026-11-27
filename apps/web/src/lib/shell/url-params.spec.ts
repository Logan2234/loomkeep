import { describe, expect, it } from "vitest";
import { adminFilterHref, enumParam } from "./url-params";

describe("adminFilterHref", () => {
  it("preserves unrelated parameters and the hash while setting filters", () => {
    const url = new URL(
      "https://loomkeep.app/app/admin/users?source=mail&q=old#list",
    );

    expect(adminFilterHref(url, { q: "new", filter: "admin" })).toBe(
      "/app/admin/users?source=mail&q=new&filter=admin#list",
    );
  });

  it("removes default filters without discarding other parameters", () => {
    const url = new URL(
      "https://loomkeep.app/app/admin/communications?tab=push&email=user%40example.com",
    );

    expect(adminFilterHref(url, { tab: null })).toBe(
      "/app/admin/communications?email=user%40example.com",
    );
  });
});

describe("enumParam", () => {
  it.each([null, "", "movie", "UNKNOWN"])(
    "rejects invalid value %s using the fallback",
    (value) => {
      const params = new URLSearchParams();
      if (value !== null) params.set("type", value);
      expect(
        enumParam(params, "type", ["MOVIE", "SERIES"] as const, "SERIES"),
      ).toBe("SERIES");
      expect(
        enumParam(params, "type", ["MOVIE", "SERIES"] as const, null),
      ).toBeNull();
    },
  );
  it("accepts allowed values without changing unrelated parameters", () => {
    const params = new URLSearchParams("type=MOVIE&q=test");
    expect(enumParam(params, "type", ["MOVIE", "SERIES"] as const, null)).toBe(
      "MOVIE",
    );
    expect(params.toString()).toBe("type=MOVIE&q=test");
  });
});
