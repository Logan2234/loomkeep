import type { DataExportListMembership } from "@loomkeep/shared";

export class DataExportListMembershipResponseDto implements DataExportListMembership {
  listTitle!: string;
  listOwnerUsername!: string;
  createdAt!: string;
}
