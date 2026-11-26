import { SESSION_DOMAINS, type SessionDomain } from "@loomkeep/shared";
import { IsIn, IsString, MaxLength } from "class-validator";
import { type HomeScreenWidgetStartTimerDto } from "../home-screen-widget.types";

export class StartTimerDto implements HomeScreenWidgetStartTimerDto {
  @IsIn(SESSION_DOMAINS)
  domain!: SessionDomain;

  @IsString()
  @MaxLength(64)
  entryId!: string;
}
