import { IsEmail, IsObject, IsOptional } from "class-validator";
import type { SendTestEmailRequestDto } from "@loomkeep/shared";

export class SendTestEmailDto implements SendTestEmailRequestDto {
  @IsEmail()
  to!: string;

  @IsOptional()
  @IsObject()
  values?: Record<string, string>;
}
