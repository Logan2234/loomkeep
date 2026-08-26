import type { Plan, UpdateAdminUserPlanRequestDto } from "@loomkeep/shared";
import { Plan as PlanValues } from "@loomkeep/shared";
import { IsIn } from "class-validator";

export class UpdateAdminUserPlanDto implements UpdateAdminUserPlanRequestDto {
  @IsIn(Object.values(PlanValues))
  plan!: Plan;
}
