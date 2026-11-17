import type { StudioPageDto } from "@loomkeep/shared";
import { CreatorSource, StudioKind } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";
import { CreatorRefResponseDto } from "../../catalog/dto/creator-ref-response.dto";
import { CreatorWorkResponseDto } from "./person-page-response.dto";

export class StudioPageResponseDto implements StudioPageDto {
  @ApiProperty({ enum: CreatorSource })
  source!: CreatorSource;

  @ApiProperty({ enum: StudioKind })
  kind!: StudioKind;

  id!: string;
  name!: string;
  logoUrl!: string | null;
  description!: string | null;
  headquarters!: string | null;
  country!: string | null;
  homepage!: string | null;

  @ApiProperty({ type: CreatorRefResponseDto, nullable: true })
  parent!: CreatorRefResponseDto | null;

  movieCount!: number;
  seriesCount!: number;
  knownFor!: CreatorWorkResponseDto[];
}
