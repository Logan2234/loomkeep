import {
  type AlertKey,
  PUSH_LIMITS,
  PUSH_SAMPLE_KEYS,
  type SendAdminTestPushRequestDto,
} from "@loomkeep/shared";
import {
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
  @IsString()
  @MaxLength(PUSH_LIMITS.title)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(PUSH_LIMITS.body)
  body?: string;
}
