import {
  PUSH_LIMITS,
  type SendAdminTestPushRequestDto,
} from "@loomkeep/shared";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class SendAdminTestPushDto implements SendAdminTestPushRequestDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(PUSH_LIMITS.title)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(PUSH_LIMITS.body)
  body?: string;
}
