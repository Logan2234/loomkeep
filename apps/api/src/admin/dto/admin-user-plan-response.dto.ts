import type { AdminUserPlanDto, Plan } from "@loomkeep/shared";

export class AdminUserPlanResponseDto implements AdminUserPlanDto {
  plan!: Plan;
}
