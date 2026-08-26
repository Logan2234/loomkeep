import type { SendAdminTestPushRequestDto } from "@loomkeep/shared";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class SendAdminTestPushDto implements SendAdminTestPushRequestDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;
}
