import type { AddListWorkRequestDto } from "@loomkeep/shared";
import { IsString, Matches } from "class-validator";

export class AddListWorkBody implements AddListWorkRequestDto {
  @IsString()
  @Matches(/^\/app\//)
  work!: string;
}
