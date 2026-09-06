import type { ImportAnalyzeRequest } from "@loomkeep/shared";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

// The request body's own ceiling (main.ts's Fastify bodyLimit, raised to 25MB
// for a full TV Time export) already bounds the whole request, but this
// field alone can otherwise still allocate up to that much before the ZIP
// reader's own limits (see import/zip.ts) even get a chance to apply —
// leaves headroom for the surrounding JSON envelope.
const MAX_IMPORT_INPUT_LENGTH = 24 * 1024 * 1024;

export class AnalyzeImportDto implements ImportAnalyzeRequest {
  /** CSV text, a Steam id, or a base64 ZIP — interpreted per the source. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_IMPORT_INPUT_LENGTH)
  input!: string;
}
