import type { ImportHistoryRunDto } from "@loomkeep/shared/contracts";
import { ImportRunResponseDto } from "./import-last-run-response.dto";

export class ImportHistoryRunResponseDto
  extends ImportRunResponseDto
  implements ImportHistoryRunDto
{
  id!: string;
  overwrite!: boolean;
  startedAt!: string;
}
