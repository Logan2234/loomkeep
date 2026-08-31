import type { SchemaGraphResponseDto } from "@loomkeep/shared";

export class SchemaGraphResultResponseDto implements SchemaGraphResponseDto {
  erd!: string | null;
  modules!: string | null;
}
