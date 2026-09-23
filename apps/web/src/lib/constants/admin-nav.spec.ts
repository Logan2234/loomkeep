import { describe, expect, it } from "vitest";
import { ADMIN_NAV, ADMIN_NAV_GROUPS } from "./admin-nav";

describe("admin navigation groups", () => {
  it("places every admin destination in exactly one group", () => {
    const grouped = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

    expect(grouped).toHaveLength(ADMIN_NAV.length);
    expect(new Set(grouped.map((item) => item.href))).toEqual(
      new Set(ADMIN_NAV.map((item) => item.href)),
    );
  });
});
