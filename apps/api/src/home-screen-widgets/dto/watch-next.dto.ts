import { IsString, MaxLength } from "class-validator";
import type { HomeScreenWidgetWatchNextDto } from "../home-screen-widget.types";

export class WatchNextDto implements HomeScreenWidgetWatchNextDto {
  @IsString()
  @MaxLength(64)
  entryId!: string;

  @IsString()
  @MaxLength(64)
  episodeId!: string;
}
