import type { ImportMatch } from "@loomkeep/shared/contracts";
import type { MediaType } from "@loomkeep/shared/enums";

export class ImportMatchResponseDto implements ImportMatch {
  source!: string;
  sourceId!: string;
  type?: MediaType;
  title!: string;
  year!: number | null;
  coverUrl!: string | null;
}
