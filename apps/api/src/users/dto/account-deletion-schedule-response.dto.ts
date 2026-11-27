import type { AccountDeletionScheduleDto } from "@loomkeep/shared/contracts";

export class AccountDeletionScheduleResponseDto implements AccountDeletionScheduleDto {
  scheduledFor!: string;
}
