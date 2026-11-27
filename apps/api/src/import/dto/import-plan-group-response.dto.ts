import type { ImportPlanGroup } from "@loomkeep/shared/contracts";
import { ImportPlanItemResponseDto } from "./import-plan-item-response.dto";

export class ImportPlanGroupResponseDto implements ImportPlanGroup {
  id!: string;
  items!: ImportPlanItemResponseDto[];
}
