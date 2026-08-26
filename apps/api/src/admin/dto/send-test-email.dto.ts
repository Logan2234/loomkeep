import type { SendTestEmailRequestDto } from "@loomkeep/shared";
import { IsEmail, IsObject, IsOptional } from "class-validator";

export class SendTestEmailDto implements SendTestEmailRequestDto {
  @IsEmail()
  to!: string;

  @IsOptional()
  @IsObject()
  values?: Record<string, string>;
}
