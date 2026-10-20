import type { ApiKeyScope, CreateApiKeyDto } from "@loomkeep/shared";
import { API_KEY_NAME_MAX_LENGTH, API_KEY_SCOPES } from "@loomkeep/shared";
import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class CreateApiKeyRequestDto implements CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(API_KEY_NAME_MAX_LENGTH)
  name!: string;

  @ApiProperty({ enum: API_KEY_SCOPES, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(API_KEY_SCOPES, { each: true })
  scopes!: ApiKeyScope[];

  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  expiresAt!: string | null;
}
