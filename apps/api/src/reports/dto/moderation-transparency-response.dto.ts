import type { ModerationTransparencyDto } from "@loomkeep/shared/contracts";
import type {
  ModerationLegalBasis,
  ModerationMeasure,
  ReportCategory,
} from "@loomkeep/shared/enums";

class TransparencyCategoryCountResponseDto {
  category!: ReportCategory;
  count!: number;
}

class TransparencyMeasureCountResponseDto {
  measure!: ModerationMeasure;
  count!: number;
}

class TransparencyLegalBasisCountResponseDto {
  legalBasis!: ModerationLegalBasis;
  count!: number;
}

class TransparencyReportsResponseDto {
  total!: number;
  withMeasure!: number;
  closedWithoutMeasure!: number;
  pending!: number;
  byCategory!: TransparencyCategoryCountResponseDto[];
  medianHandlingHours!: number | null;
}

class TransparencyMeasuresResponseDto {
  total!: number;
  withoutReport!: number;
  byMeasure!: TransparencyMeasureCountResponseDto[];
  byLegalBasis!: TransparencyLegalBasisCountResponseDto[];
}

export class ModerationTransparencyResponseDto implements ModerationTransparencyDto {
  year!: number;
  years!: number[];
  reports!: TransparencyReportsResponseDto;
  measures!: TransparencyMeasuresResponseDto;
}
