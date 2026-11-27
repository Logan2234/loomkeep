import type { SetEmailMfaRequestDto } from "@loomkeep/shared/contracts";
import { IsBoolean } from "class-validator";

export class SetEmailMfaDto implements SetEmailMfaRequestDto {
  @IsBoolean()
  enabled!: boolean;
}
