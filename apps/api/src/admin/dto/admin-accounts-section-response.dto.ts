import type {
  AdminAccountsSectionDto,
  AdminAgeBucketDto,
  AdminCohortRowDto,
  AdminEnabledDomainsBucketDto,
  Locale,
  ProfileAccess,
} from "@loomkeep/shared";
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
}
