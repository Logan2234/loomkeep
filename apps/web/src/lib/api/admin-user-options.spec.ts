import type { AdminUserOptionDto } from "@loomkeep/shared";
import { describe, expect, it } from "vitest";
import { normalizeAdminUserOptionsPage } from "./admin";

const user: AdminUserOptionDto = {
  id: "user-1",
  displayName: "Alice",
  email: "alice@example.com",
};

describe("normalizeAdminUserOptionsPage", () => {
  it("keeps the current paginated response", () => {
    expect(
      normalizeAdminUserOptionsPage({ items: [user], hasMore: true }),
    ).toEqual({ items: [user], hasMore: true });
  });

  it("accepts the previous array response during a rolling deployment", () => {
    expect(normalizeAdminUserOptionsPage([user])).toEqual({
      items: [user],
      hasMore: false,
    });
  });
});
