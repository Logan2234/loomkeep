import type { PossessionBreakdownDto } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

// PossessionBreakdownDto is a discriminated union — the swagger plugin can't
// infer a union directly, so each branch gets its own class and the
// controller composes them with @ApiExtraModels + oneOf, same technique as
// auth/dto/login-response.dto.ts.
type SufficientPossessionBreakdown = Extract<
  PossessionBreakdownDto,
  { sufficientData: true }
>;
type InsufficientPossessionBreakdown = Extract<
  PossessionBreakdownDto,
  { sufficientData: false }
>;

class PossessionStatusCountResponseDto {
  status!: string;
  count!: number;
}

export class SufficientPossessionBreakdownResponseDto implements SufficientPossessionBreakdown {
  @ApiProperty({ enum: [true] })
  sufficientData!: true;

  byStatus!: PossessionStatusCountResponseDto[];
}

export class InsufficientPossessionBreakdownResponseDto implements InsufficientPossessionBreakdown {
  @ApiProperty({ enum: [false] })
  sufficientData!: false;

  renseignedRatio!: number;
}
