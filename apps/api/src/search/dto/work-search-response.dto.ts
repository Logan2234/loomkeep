import type {
  MessageWorkKind,
  WorkSearchHitDto,
  WorkSearchResultDto,
} from "@loomkeep/shared/contracts";
import type { Domain } from "@loomkeep/shared/enums";

export class WorkSearchHitResponseDto implements WorkSearchHitDto {
  kind!: MessageWorkKind;
  title!: string;
  imageUrl!: string | null;
  href!: string;
  year!: number | null;
  isAdult!: boolean;
  status!: string | null;
}

export class WorkSearchResultResponseDto implements WorkSearchResultDto {
  items!: WorkSearchHitResponseDto[];
  unavailable!: Domain[];
}
