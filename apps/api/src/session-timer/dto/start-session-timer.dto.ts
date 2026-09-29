import type { StartSessionTimerDto as Contract } from "@loomkeep/shared";
import { Domain, SessionCycleAction } from "@loomkeep/shared";
import { IsIn, IsOptional, IsString } from "class-validator";

export class StartSessionTimerDto implements Contract {
  @IsIn([Domain.GAMES, Domain.BOOKS])
  domain!: typeof Domain.GAMES | typeof Domain.BOOKS;

  @IsString()
  entryId!: string;

  @IsOptional()
  @IsIn(Object.values(SessionCycleAction))
  cycleAction?: SessionCycleAction;
}
