import { IsOptional, IsString, MaxLength } from "class-validator";
import type { SendAdminBroadcastPushRequestDto } from "@loomkeep/shared";

export class SendAdminBroadcastPushDto implements SendAdminBroadcastPushRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;
}
