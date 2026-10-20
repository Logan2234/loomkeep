import type { AdjustAdminUserXpRequestDto } from "@loomkeep/shared";
import { IsInt, Max, Min, NotEquals } from "class-validator";

// No business cap on an adjustment. The bounds are the database's: XP is
// stored as a 32-bit integer.
const INT32_MAX = 2_147_483_647;

export class AdjustAdminUserXpDto implements AdjustAdminUserXpRequestDto {
  @IsInt()
  @NotEquals(0)
  @Min(-INT32_MAX)
  @Max(INT32_MAX)
  amount!: number;
}
