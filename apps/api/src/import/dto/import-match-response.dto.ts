import type { ImportMatch, MediaType } from "@loomkeep/shared";

export class ImportMatchResponseDto implements ImportMatch {
  source!: string;
  sourceId!: string;
  type?: MediaType;
  title!: string;
  year!: number | null;
  coverUrl!: string | null;
}
