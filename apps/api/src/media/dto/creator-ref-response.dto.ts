import type { CreatorRefDto } from "@loomkeep/shared/contracts";
import { CreatorSource } from "@loomkeep/shared/contracts";
import { ApiProperty } from "@nestjs/swagger";

export class CreatorRefResponseDto implements CreatorRefDto {
  @ApiProperty({ enum: CreatorSource })
  source!: CreatorSource;

  id!: string;
  name!: string;
}
