import type { Domain, ImportPlan } from "@loomkeep/shared";
import { ImportPlanGroupResponseDto } from "./import-plan-group-response.dto";

class ImportPlanCountsResponseDto {
  total!: number;
  matched!: number;
  unresolved!: number;
  apiErrors!: number;
}

export class ImportPlanResponseDto implements ImportPlan {
  groups!: ImportPlanGroupResponseDto[];
  counts!: ImportPlanCountsResponseDto;
  searchDomain!: Domain;
}
