import type { Locale } from "@loomkeep/shared/catalog";
import type {
  AdminAccountsSectionDto,
  AdminAgeBucketDto,
  AdminCohortRowDto,
  AdminEnabledDomainsBucketDto,
} from "@loomkeep/shared/contracts";
import type {
  AccountDeletionReason,
  AcquisitionSource,
  ProfileAccess,
} from "@loomkeep/shared/enums";
import { AdminNewAccountsTrendResponseDto } from "./admin-new-accounts-trend-response.dto";

class AdminCohortRowResponseDto implements AdminCohortRowDto {
  month!: string;
  size!: number;
  retention!: number[];
}

class AdminEnabledDomainsBucketResponseDto implements AdminEnabledDomainsBucketDto {
  domains!: number;
  accounts!: number;
}

class AdminProfileAccessCountResponseDto {
  access!: ProfileAccess;
  count!: number;
}

class AdminAccountHealthResponseDto {
  active24h!: number;
  active30d!: number;
  dormant!: number;
  activeSessions!: number;
  emailVerified!: number;
  withPush!: number;
  withNewsletter!: number;
  withEpisodeEmail!: number;
}

class AdminAgeBucketResponseDto implements AdminAgeBucketDto {
  label!: string;
  count!: number;
}

class AdminAgeStatsResponseDto {
  distribution!: AdminAgeBucketResponseDto[];
  birthDateSetPercent!: number;
  adultContentPercent!: number;
}

class AdminLocaleCountResponseDto {
  locale!: Locale;
  count!: number;
}

class AdminDepartureReasonCountResponseDto {
  reason!: AccountDeletionReason;
  count!: number;
}

class AdminAcquisitionSourceCountResponseDto {
  source!: AcquisitionSource;
  count!: number;
}

class AdminAcquisitionStatsResponseDto {
  bySource!: AdminAcquisitionSourceCountResponseDto[];
  recentOther!: string[];
}

export class AdminAccountsSectionResponseDto implements AdminAccountsSectionDto {
  generatedAt!: string;
  total!: number;
  newAccounts!: AdminNewAccountsTrendResponseDto;
  cohorts!: AdminCohortRowResponseDto[];
  byEnabledDomainCount!: AdminEnabledDomainsBucketResponseDto[];
  byProfileAccess!: AdminProfileAccessCountResponseDto[];
  health!: AdminAccountHealthResponseDto;
  age!: AdminAgeStatsResponseDto;
  byLocale!: AdminLocaleCountResponseDto[];
  departureReasons!: AdminDepartureReasonCountResponseDto[];
  departures!: number;
  acquisition!: AdminAcquisitionStatsResponseDto;
}
