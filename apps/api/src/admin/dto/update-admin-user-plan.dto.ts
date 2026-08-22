import { IsIn } from "class-validator";
import type { Plan, UpdateAdminUserPlanRequestDto } from "@loomkeep/shared";
import { Plan as PlanValues } from "@loomkeep/shared";

export class UpdateAdminUserPlanDto implements UpdateAdminUserPlanRequestDto {
  @IsIn(Object.values(PlanValues))
  plan!: Plan;
}
