import type {
  AdminBackupFileDto,
  AdminBackupInventoryDto,
} from "@loomkeep/shared";

type LegacyBackupFileDto = Omit<AdminBackupFileDto, "status">;

export function normalizeAdminBackupInventory(
  response: AdminBackupInventoryDto | LegacyBackupFileDto[],
): AdminBackupInventoryDto {
  return Array.isArray(response)
    ? {
        files: response.map((file) => ({ ...file, status: "AVAILABLE" })),
        orphans: [],
      }
    : response;
}
