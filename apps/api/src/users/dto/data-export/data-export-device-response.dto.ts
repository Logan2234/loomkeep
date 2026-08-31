import type { DataExportDevice } from "@loomkeep/shared";

export class DataExportDeviceResponseDto implements DataExportDevice {
  deviceKey!: string;
  userAgent!: string | null;
  firstSeenAt!: string;
  lastSeenAt!: string;
}
