import type {
  DigestCadence,
  Domain,
  ListVisibility,
  Locale,
  ReviewVisibility,
  UpdateUserRequestDto,
} from "@loomkeep/shared";
import {
  DigestCadence as DigestCadenceValues,
  Domain as DomainValues,
  ListVisibility as ListVisibilityValues,
  ReviewVisibility as ReviewVisibilityValues,
} from "@loomkeep/shared";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

// Mirrors `locales` in apps/web/project.inlang/settings.json — the set of
// locales Paraglide actually has translations for.
const ALLOWED_LOCALES = ["fr", "en"];

export class UpdateUserDto implements UpdateUserRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string | null;

  @IsOptional()
  @IsBoolean()
  allowAdultContent?: boolean;

  @IsOptional()
  @IsIn(Object.values(DigestCadenceValues))
  notifyEmail?: DigestCadence;

  @IsOptional()
  @IsIn(Object.values(DigestCadenceValues))
  notifyPush?: DigestCadence;

  @IsOptional()
  @IsBoolean()
  notifyNewsletter?: boolean;

  // Not validated against the IANA database (no bundled tz-data source of
  // truth) — an invalid value just means the digest cron's Intl.DateTimeFormat
  // call fails softly for that user (see NotificationDigestService), same
  // failure mode as any other malformed free-text field.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  // At least one domain must stay visible; each must be a known Domain.
  @IsOptional()
  @ArrayNotEmpty()
  @IsIn(Object.values(DomainValues), { each: true })
  enabledDomains?: Domain[];

  // Ordered mobile bottom-bar shortcut ids (3–7, unique). Individual ids aren't
  // enum-checked here — they're a web-UI vocabulary and unknown ones are simply
  // ignored at render time — but the required "menu" launcher is enforced in the
  // controller. See web navigation.ts.
  @IsOptional()
  @ArrayMinSize(3)
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsString({ each: true })
  mobileNavShortcuts?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @IsOptional()
  @IsIn(Object.values(ReviewVisibilityValues))
  defaultReviewVisibility?: ReviewVisibility;

  @IsOptional()
  @IsIn(Object.values(ListVisibilityValues))
  defaultListVisibility?: ListVisibility;

  @IsOptional()
  @IsIn(ALLOWED_LOCALES)
  locale?: Locale;
}
