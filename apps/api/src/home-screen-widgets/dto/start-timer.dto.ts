import {
  type HomeScreenWidgetStartTimerDto,
  SESSION_DOMAINS,
  type SessionDomain,
} from "@loomkeep/shared";
import { IsIn, IsString, MaxLength } from "class-validator";

export class StartTimerDto implements HomeScreenWidgetStartTimerDto {
  @IsIn(SESSION_DOMAINS)
  domain!: SessionDomain;

  @IsString()
  @MaxLength(64)
  entryId!: string;
}
