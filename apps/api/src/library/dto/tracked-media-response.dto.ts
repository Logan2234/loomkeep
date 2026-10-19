import type { EntryStatus, MediaType, TrackedMediaDto } from "@loomkeep/shared";

export class TrackedMediaResponseDto implements TrackedMediaDto {
  type!: MediaType;
  sourceId!: string;
  status!: EntryStatus;
}
