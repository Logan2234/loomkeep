import {
  type StartSessionTimerDto as Contract,
  SESSION_DOMAINS,
  SessionCycleAction,
  type SessionDomain,
} from "@loomkeep/shared";

import { IsIn, IsOptional, IsString } from "class-validator";

export class StartSessionTimerDto implements Contract {
  @IsIn(SESSION_DOMAINS)
  domain!: SessionDomain;

  @IsString()
  entryId!: string;

  @IsOptional()
  @IsIn(Object.values(SessionCycleAction))
  cycleAction?: SessionCycleAction;
}
