import type { AdminUpdateStatusDto } from "@loomkeep/shared";

export class AdminUpdateStatusResponseDto implements AdminUpdateStatusDto {
  enabled!: boolean;
  currentVersion!: string;
  latestVersion!: string | null;
  updateAvailable!: boolean;
  checkedAt!: string | null;
  lastCheckFailed!: boolean;
}
