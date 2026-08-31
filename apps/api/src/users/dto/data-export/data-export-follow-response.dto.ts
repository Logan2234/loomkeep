import type { DataExportFollow, FollowStatus } from "@loomkeep/shared";

export class DataExportFollowResponseDto implements DataExportFollow {
  username!: string;
  status!: FollowStatus;
  createdAt!: string;
}
