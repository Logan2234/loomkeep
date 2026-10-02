import type {
  AlertPrefs,
  DigestCadence,
  Domain,
  ListVisibility,
  Locale,
  ReviewVisibility,
  SpoilerSensitivity,
  UpdateUserRequestDto,
} from "@loomkeep/shared";
import {
  DigestCadence as DigestCadenceValues,
  Domain as DomainValues,
  ListVisibility as ListVisibilityValues,
  Locale as LocaleValues,
  ReviewVisibility as ReviewVisibilityValues,
  SpoilerSensitivity as SpoilerSensitivityValues,
} from "@loomkeep/shared";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

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

  // Checked against ALERTS by UsersService (mergeAlertPrefs), not here.
  @IsOptional()
  @IsObject()
  alertPrefs?: AlertPrefs;

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
  @IsIn([...LocaleValues])
  locale?: Locale;

  @IsOptional()
  @IsBoolean()
  hideProgression?: boolean;

  @IsOptional()
  @IsIn(Object.values(SpoilerSensitivityValues))
  spoilerSensitivity?: SpoilerSensitivity;

  // Empty is valid (resets to canonical order) — unlike enabledDomains,
  // nothing here needs to stay visible.
  @IsOptional()
  @ArrayMaxSize(Object.values(DomainValues).length)
  @ArrayUnique()
  @IsIn(Object.values(DomainValues), { each: true })
  domainOrder?: Domain[];

  // An ISO 3166-1 code; null (let through by IsOptional) is "automatic".
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  watchRegion?: string | null;

  // Not checked against TMDB's list: an unknown id just never matches an offer.
  @IsOptional()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  watchProviderIds?: number[];
}
