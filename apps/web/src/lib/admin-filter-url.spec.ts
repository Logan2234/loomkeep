import { describe, expect, it } from "vitest";
import { adminFilterHref } from "./admin-filter-url";

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
