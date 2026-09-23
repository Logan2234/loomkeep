import { describe, expect, it } from "vitest";
import { adminPageLayout } from "./admin-layout";

describe("admin page layout", () => {
  it("assigns explicit reading, operations and data layouts", () => {
    expect(adminPageLayout("/app/admin/backup")).toBe("reading");
    expect(adminPageLayout("/app/admin/users")).toBe("operations");
    expect(adminPageLayout("/app/admin/stats")).toBe("data");
  });

  it("keeps nested routes in their parent layout", () => {
    expect(adminPageLayout("/app/admin/users/user-1")).toBe("operations");
  });
});
