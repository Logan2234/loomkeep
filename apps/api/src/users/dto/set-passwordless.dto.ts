import type { SetPasswordlessRequestDto } from "@loomkeep/shared";
import { IsBoolean } from "class-validator";

export class SetPasswordlessDto implements SetPasswordlessRequestDto {
  @IsBoolean()
  enabled!: boolean;
}
