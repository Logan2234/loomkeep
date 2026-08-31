import type { ImportPlanGroup } from "@loomkeep/shared";
import { ImportPlanItemResponseDto } from "./import-plan-item-response.dto";

export class ImportPlanGroupResponseDto implements ImportPlanGroup {
  id!: string;
  label!: string;
  items!: ImportPlanItemResponseDto[];
}
