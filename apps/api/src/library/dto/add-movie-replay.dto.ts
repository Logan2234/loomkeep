import { IsDateString, IsOptional } from "class-validator";

export class AddMovieReplayDto {
  /** Defaults to now. */
  @IsOptional()
  @IsDateString()
  finishedAt?: string;
}
