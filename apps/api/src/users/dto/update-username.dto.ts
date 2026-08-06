import { IsString, MaxLength, MinLength } from "class-validator";
import type { UpdateUsernameRequestDto } from "@loomkeep/shared";

export class UpdateUsernameDto implements UpdateUsernameRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  username!: string;
}
