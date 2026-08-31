import type { DataExportBlock } from "@loomkeep/shared";

export class DataExportBlockResponseDto implements DataExportBlock {
  username!: string;
  createdAt!: string;
}
