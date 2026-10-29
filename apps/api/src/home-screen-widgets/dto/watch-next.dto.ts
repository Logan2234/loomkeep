import type { HomeScreenWidgetWatchNextDto } from "@loomkeep/shared";
import { IsString, MaxLength } from "class-validator";

export class WatchNextDto implements HomeScreenWidgetWatchNextDto {
  @IsString()
  @MaxLength(64)
  entryId!: string;

  @IsString()
  @MaxLength(64)
  episodeId!: string;
}
