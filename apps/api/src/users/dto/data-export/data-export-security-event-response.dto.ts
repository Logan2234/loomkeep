import type {
  DataExportSecurityEvent,
  SecurityEventType,
} from "@loomkeep/shared";

export class DataExportSecurityEventResponseDto implements DataExportSecurityEvent {
  type!: SecurityEventType;
  identifier!: string;
  detail!: string | null;
  userAgent!: string | null;
  createdAt!: string;
}
