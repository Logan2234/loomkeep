import {
  USER_LIMITS,
  type UpdateUsernameRequestDto,
} from "@loomkeep/shared/contracts";
import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength } from "class-validator";

export class UpdateUsernameDto implements UpdateUsernameRequestDto {
  // Stored lowercase, like the generated ones (User_username_lowercase_check):
  // sign-in lowercases the identifier, and two accounts can't differ by case.
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(USER_LIMITS.username)
  username!: string;
}
