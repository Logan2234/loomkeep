import type { AdminUserPlanDto } from "@loomkeep/shared/contracts";
import type { Plan } from "@loomkeep/shared/enums";

export class AdminUserPlanResponseDto implements AdminUserPlanDto {
  plan!: Plan;
  expiresAt!: string | null;
}
