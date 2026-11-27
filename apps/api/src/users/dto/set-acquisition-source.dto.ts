import {
  ACQUISITION_SOURCE_OTHER_MAX_LENGTH,
  type SetAcquisitionSourceRequestDto,
} from "@loomkeep/shared/contracts";
import { AcquisitionSource } from "@loomkeep/shared/enums";
import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class SetAcquisitionSourceDto implements SetAcquisitionSourceRequestDto {
  @ApiProperty({ enum: Object.values(AcquisitionSource) })
  @IsIn(Object.values(AcquisitionSource))
  source!: AcquisitionSource;

  @IsOptional()
  @IsString()
  @MaxLength(ACQUISITION_SOURCE_OTHER_MAX_LENGTH)
  other?: string;
}
