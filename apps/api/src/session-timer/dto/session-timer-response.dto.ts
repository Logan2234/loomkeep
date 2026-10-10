import {
  SESSION_DOMAINS,
  type SessionDomain,
  type SessionTimerDto,
} from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

export class SessionTimerResponseDto implements SessionTimerDto {
  id!: string;

  @ApiProperty({ enum: SESSION_DOMAINS })
  domain!: SessionDomain;

  entryId!: string;
  startedAt!: string;
  pausedAt!: string | null;
  elapsedSeconds!: number;
}
