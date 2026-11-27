import { Locale, type Locale as LocaleCode } from "@loomkeep/shared/catalog";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";

const ACCESSIBILITY_REPORT_LIMITS = {
  messageMin: 20,
  messageMax: 5000,
  page: 300,
} as const;

export class AccessibilityReportBody {
  @IsString()
  @Length(
    ACCESSIBILITY_REPORT_LIMITS.messageMin,
    ACCESSIBILITY_REPORT_LIMITS.messageMax,
  )
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(ACCESSIBILITY_REPORT_LIMITS.page)
  page?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  /** The language the visitor wrote in, for the email's own wording. */
  @IsOptional()
  @IsIn(Locale)
  locale?: LocaleCode;

  /**
   * A field no person sees or fills: a value means a bot filled every input,
   * and the report is dropped while still answering as if it went through.
   */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  // Required only when TURNSTILE_SECRET_KEY is set, as on registration.
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
