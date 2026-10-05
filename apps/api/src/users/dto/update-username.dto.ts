import { USER_LIMITS } from "@loomkeep/shared";
import { IsString, MaxLength, MinLength } from "class-validator";

export class UpdateUsernameDto implements UpdateUsernameRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(USER_LIMITS.username)
  username!: string;
}
