import type { AddListMemberDto } from "@loomkeep/shared";
import { IsString, MinLength } from "class-validator";

export class AddListMemberBody implements AddListMemberDto {
  @IsString()
  @MinLength(1)
  username!: string;
}
