import { type AlertKey, PUSH_SAMPLE_KEYS } from "@loomkeep/shared/catalog";
import {
  PUSH_LIMITS,
  type SendAdminTestPushRequestDto,
} from "@loomkeep/shared/contracts";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class SendAdminTestPushDto implements SendAdminTestPushRequestDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(PUSH_SAMPLE_KEYS)
  type?: AlertKey;

  @IsOptional()
  @IsBoolean()
  failingActions?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(PUSH_LIMITS.title)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(PUSH_LIMITS.body)
  body?: string;
}
