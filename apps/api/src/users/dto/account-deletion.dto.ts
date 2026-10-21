import {
  AccountDeletionReason,
  type CancelAccountDeletionRequestDto,
  type ScheduleAccountDeletionRequestDto,
} from "@loomkeep/shared";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

export class ScheduleAccountDeletionDto implements ScheduleAccountDeletionRequestDto {
  @ApiPropertyOptional({ enum: Object.values(AccountDeletionReason) })
  @IsOptional()
  @IsIn(Object.values(AccountDeletionReason))
  reason?: AccountDeletionReason;
}

export class CancelAccountDeletionDto implements CancelAccountDeletionRequestDto {
  @IsString()
  token!: string;
}
