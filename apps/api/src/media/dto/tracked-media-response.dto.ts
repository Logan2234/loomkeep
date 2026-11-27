import type { TrackedMediaDto } from "@loomkeep/shared/contracts";
import type { EntryStatus, MediaType } from "@loomkeep/shared/enums";

export class TrackedMediaResponseDto implements TrackedMediaDto {
  type!: MediaType;
  sourceId!: string;
  status!: EntryStatus;
}
