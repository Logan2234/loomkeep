import type { ImportAnalyzeRequest } from "@loomkeep/shared";
import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

export class AnalyzeImportDto implements ImportAnalyzeRequest {
  /** CSV text, a Steam id, or a base64 ZIP — interpreted per the source. */
  @IsString()
  @IsNotEmpty()
  input!: string;

  // Free-form boolean toggles (e.g. TV Time's `importMovies`); read defensively.
  @IsOptional()
  @IsObject()
  options?: Record<string, boolean>;
}
