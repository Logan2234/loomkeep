import { ErrorCode } from "@loomkeep/shared";
import * as bcrypt from "bcryptjs";
import { vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { AdminOverviewService } from "./admin-overview.service";
import { AdminSystemController } from "./admin-system.controller";
import type { AdminService } from "./admin.service";
import type { BackupService } from "./backup.service";

function makeController(passwordHash: string) {
  const backup = { restore: vi.fn() } as unknown as BackupService;
  const prisma = {
    user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ passwordHash }) },
  } as unknown as PrismaService;

  return {
    controller: new AdminSystemController(
      {} as AdminService,
      {} as AdminOverviewService,
      backup,
      prisma,
    ),
    backup,
  };
}

describe("AdminSystemController.restoreBackup", () => {
  it("rejects an incorrect current password before restoring", async () => {
    const { controller, backup } = makeController(
      await bcrypt.hash("correct", 4),
    );

    await expect(
      controller.restoreBackup(
        { sub: "admin-1", email: "admin@example.com" },
        { sql: "SELECT 1", currentPassword: "wrong" },
      ),
    ).rejects.toMatchObject({ code: ErrorCode.AuthCurrentPasswordIncorrect });

    expect(backup.restore).not.toHaveBeenCalled();
  });

  it("restores after the current password is confirmed", async () => {
    const { controller, backup } = makeController(
      await bcrypt.hash("correct", 4),
    );

    await controller.restoreBackup(
      { sub: "admin-1", email: "admin@example.com" },
      { sql: "SELECT 1", currentPassword: "correct" },
    );

    expect(backup.restore).toHaveBeenCalledWith("SELECT 1");
  });
});
