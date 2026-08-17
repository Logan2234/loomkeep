import type { ImportAnalyzeRequest } from "@loomkeep/shared";
import { IsNotEmpty, IsString } from "class-validator";

export class AnalyzeImportDto implements ImportAnalyzeRequest {
  /** CSV text, a Steam id, or a base64 ZIP — interpreted per the source. */
  @IsString()
  @IsNotEmpty()
  input!: string;
}
