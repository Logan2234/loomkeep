import type {
  DomainPileDto,
  PileSummaryDto,
  StatsDomain,
} from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";

export class PileSummaryResponseDto implements PileSummaryDto {
  @ApiProperty({ enum: ["MINUTES", "PAGES"] })
  unit!: "MINUTES" | "PAGES";

  amount!: number;
  entries!: number;
  counted!: number;
  estimated!: boolean;
}

export class DomainPileResponseDto implements DomainPileDto {
  domain!: StatsDomain;
  pile!: PileSummaryResponseDto;
}
