import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import type {
  CreateChangelogEntryRequestDto,
  UpdateChangelogEntryRequestDto,
} from "@loomkeep/shared";

/** Same shape for create and update — a version can be corrected after the fact. */
export class ChangelogEntryDto
  implements CreateChangelogEntryRequestDto, UpdateChangelogEntryRequestDto
{
  @Matches(/^\d+\.\d+\.\d+$/, { message: "version must look like 1.2.0" })
  version!: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  highlights!: string[];
}
