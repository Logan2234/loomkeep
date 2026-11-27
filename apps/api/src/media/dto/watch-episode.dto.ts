import { IsDateString, IsOptional } from "class-validator";

export class WatchEpisodeDto {
  /** Defaults to now. */
  @IsOptional()
  @IsDateString()
  watchedAt?: string;
}
