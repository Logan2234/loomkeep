import type { SetPasswordlessRequestDto } from "@loomkeep/shared/contracts";
import { IsBoolean } from "class-validator";

export class SetPasswordlessDto implements SetPasswordlessRequestDto {
  @IsBoolean()
  enabled!: boolean;
}
