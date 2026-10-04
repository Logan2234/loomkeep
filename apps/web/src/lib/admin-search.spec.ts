import { describe, expect, it } from "vitest";
import { searchAdminSections } from "./admin-search";

describe("admin section search", () => {
  it("finds settings by a control keyword and users by invitations", () => {
    expect(
      searchAdminSections("quotas")
        .flatMap((group) => group.items)
        .some((item) => item.href === "/app/admin/settings"),
    ).toBe(true);
    expect(
      searchAdminSections("invitations")
        .flatMap((group) => group.items)
        .map((item) => item.href),
    ).toContain("/app/admin/users");
  });
  it("returns no sections for an unmatched query", () => {
    expect(searchAdminSections("zzzz-no-match")).toEqual([]);
  });
});
