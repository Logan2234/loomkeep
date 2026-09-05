import {
  Locale,
  type Locale as LocaleCode,
  type SendTestEmailRequestDto,
} from "@loomkeep/shared";
import { IsEmail, IsIn, IsObject, IsOptional } from "class-validator";

export class SendTestEmailDto implements SendTestEmailRequestDto {
  @IsEmail()
  to!: string;

  @IsIn(Locale)
  locale!: LocaleCode;

  @IsOptional()
  @IsObject()
  values?: Record<string, string>;
}
