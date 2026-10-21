import type { AccountDeletionScheduleDto } from "@loomkeep/shared";

export class AccountDeletionScheduleResponseDto implements AccountDeletionScheduleDto {
  scheduledFor!: string;
}
