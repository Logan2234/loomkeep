import type {
  AdminUserApiKeyDto,
  AdminUserDetailDto,
  AdminUserDeviceDto,
  AdminUserImportDto,
  AdminUserModerationDecisionDto,
  AdminUserPushSubscriptionDto,
  AdminUserRecentAdditionDto,
  AdminUserSecurityEventDto,
} from "@loomkeep/shared/contracts";
import type {
  AcquisitionSource,
  DigestCadence,
  Domain,
  ModerationMeasure,
  ProfileAccess,
  PushPlatform,
  ReviewVisibility,
  SecurityEventType,
} from "@loomkeep/shared/enums";
import { AdminUserResponseDto } from "./admin-user-response.dto";

class AdminUserJourneyResponseDto {
  onboardedAt!: string | null;
  acquisitionSource!: AcquisitionSource | null;
  acquisitionSourceOther!: string | null;
  acceptedTermsVersion!: string | null;
  acceptedTermsAt!: string | null;
  ageBracket!: string | null;
}

class AdminUserApiKeyResponseDto implements AdminUserApiKeyDto {
  id!: string;
  name!: string;
  suffix!: string;
  lastUsedAt!: string | null;
  expiresAt!: string | null;
}

class AdminUserDeviceResponseDto implements AdminUserDeviceDto {
  id!: string;
  userAgent!: string | null;
  lastSeenAt!: string;
}

class AdminUserPushSubscriptionResponseDto implements AdminUserPushSubscriptionDto {
  id!: string;
  platform!: PushPlatform;
  userAgent!: string | null;
  createdAt!: string;
}

class AdminUserSecurityEventResponseDto implements AdminUserSecurityEventDto {
  id!: string;
  type!: SecurityEventType;
  createdAt!: string;
}

class AdminUserSecurityResponseDto {
  passkeys!: number;
  passwordless!: boolean;
  recoveryCodesLeft!: number;
  apiKeys!: AdminUserApiKeyResponseDto[];
  devices!: AdminUserDeviceResponseDto[];
  pushSubscriptions!: AdminUserPushSubscriptionResponseDto[];
  events!: AdminUserSecurityEventResponseDto[];
}

class AdminUserPreferencesResponseDto {
  locale!: string;
  timezone!: string;
  watchRegion!: string | null;
  watchProviderCount!: number;
  notifyEmail!: DigestCadence;
  notifyPush!: DigestCadence;
  newsletter!: boolean;
  newsletterOptInAt!: string | null;
  profileAccess!: ProfileAccess;
  defaultReviewVisibility!: ReviewVisibility;
  allowAdultContent!: boolean;
}

class AdminUserImportResponseDto implements AdminUserImportDto {
  id!: string;
  sourceId!: string;
  status!: string;
  itemCount!: number;
  finishedAt!: string;
}

class AdminUserRecentAdditionResponseDto implements AdminUserRecentAdditionDto {
  id!: string;
  title!: string;
  domain!: Domain;
  href!: string | null;
  addedAt!: string;
}

class AdminUserEngagementResponseDto {
  achievements!: number;
  sharedListMemberships!: number;
  savedViews!: number;
}

class AdminUserModerationDecisionResponseDto implements AdminUserModerationDecisionDto {
  id!: string;
  measure!: ModerationMeasure;
  tosClause!: string;
  decidedAt!: string;
  decidedByName!: string | null;
}

class AdminUserModerationResponseDto {
  decisions!: AdminUserModerationDecisionResponseDto[];
  reportsFiled!: number;
  blocking!: number;
  blockedBy!: number;
}

export class AdminUserDetailResponseDto implements AdminUserDetailDto {
  user!: AdminUserResponseDto;
  journey!: AdminUserJourneyResponseDto;
  security!: AdminUserSecurityResponseDto;
  preferences!: AdminUserPreferencesResponseDto;
  imports!: AdminUserImportResponseDto[];
  recentAdditions!: AdminUserRecentAdditionResponseDto[];
  engagement!: AdminUserEngagementResponseDto;
  moderation!: AdminUserModerationResponseDto;
}
