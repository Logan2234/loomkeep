import { PUSH_LIMITS } from "@loomkeep/shared";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class SendAdminBroadcastPushDto implements SendAdminBroadcastPushRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(PUSH_LIMITS.title)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(PUSH_LIMITS.body)
  body?: string;
}
