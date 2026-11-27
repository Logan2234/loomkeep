import type { SchemaGraphResponseDto } from "@loomkeep/shared/contracts";

export class SchemaGraphResultResponseDto implements SchemaGraphResponseDto {
  erd!: string | null;
}
