import type { UpdateAdminUserPlanRequestDto } from "@loomkeep/shared/contracts";
import type { Plan } from "@loomkeep/shared/enums";
import { Plan as PlanValues } from "@loomkeep/shared/enums";
import { IsIn, IsISO8601, IsOptional } from "class-validator";

export class UpdateAdminUserPlanDto implements UpdateAdminUserPlanRequestDto {
  @IsIn(Object.values(PlanValues))
  plan!: Plan;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;
}
