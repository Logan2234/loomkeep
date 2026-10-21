import type {
  Domain,
  ImportPlan,
  ImportPlanList,
  MediaType,
} from "@loomkeep/shared";
import { ImportPlanGroupResponseDto } from "./import-plan-group-response.dto";

class ImportPlanListResponseDto implements ImportPlanList {
  name!: string;
  itemCount!: number;
}

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
  searchMediaType?: MediaType;
  lists?: ImportPlanListResponseDto[];
}
