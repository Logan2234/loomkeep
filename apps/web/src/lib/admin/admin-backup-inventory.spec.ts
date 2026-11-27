import { describe, expect, it } from "vitest";
import { normalizeAdminBackupInventory } from "./admin-backup-inventory";

const file = {
  id: "backup-1",
  filename: "loomkeep-2026-09-23-18-27-52.sql.age",
  sizeBytes: 123,
  createdAt: "2026-09-23T18:27:52.248Z",
};

describe("normalizeAdminBackupInventory", () => {
  it("shows backups returned by an API that still uses the array response", () => {
    expect(normalizeAdminBackupInventory([file])).toEqual({
      files: [{ ...file, status: "AVAILABLE" }],
      orphans: [],
    });
  });

  it("preserves inventory and orphan details from the updated API", () => {
    const inventory = {
      files: [{ ...file, status: "MISSING" as const }],
      orphans: [
        { filename: file.filename, sizeBytes: 123, createdAt: file.createdAt },
      ],
    };
    expect(normalizeAdminBackupInventory(inventory)).toEqual(inventory);
  });
});
