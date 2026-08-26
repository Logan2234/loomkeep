import type { UpdateUsernameRequestDto } from "@loomkeep/shared";
import { IsString, MaxLength, MinLength } from "class-validator";

export class UpdateUsernameDto implements UpdateUsernameRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  username!: string;
}
