import { IsBoolean } from "class-validator";
import type { SetEmailMfaRequestDto } from "@loomkeep/shared";

export class SetEmailMfaDto implements SetEmailMfaRequestDto {
  @IsBoolean()
  enabled!: boolean;
}
