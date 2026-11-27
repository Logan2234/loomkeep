import {
  type StartSessionTimerDto as Contract,
  SESSION_DOMAINS,
  type SessionDomain,
} from "@loomkeep/shared/contracts";
import { SessionCycleAction } from "@loomkeep/shared/enums";

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
