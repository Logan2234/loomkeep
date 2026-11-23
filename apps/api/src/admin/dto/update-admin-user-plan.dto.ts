import type { Plan, UpdateAdminUserPlanRequestDto } from "@loomkeep/shared";
import { Plan as PlanValues } from "@loomkeep/shared";
import { IsIn, IsISO8601, IsOptional } from "class-validator";

export class UpdateAdminUserPlanDto implements UpdateAdminUserPlanRequestDto {
  @IsIn(Object.values(PlanValues))
  plan!: Plan;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;
}
