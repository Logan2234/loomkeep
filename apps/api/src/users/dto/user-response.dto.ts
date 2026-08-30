import type {
  DigestCadence,
  Domain,
  ListVisibility,
  Locale,
  ProfileAccess,
  ReviewVisibility,
  Role,
  UserDto,
} from "@loomkeep/shared";

export class UserResponseDto implements UserDto {
  id!: string;
  email!: string;
  username!: string;
  displayName!: string;
  birthDate!: string | null;
  allowAdultContent!: boolean;
  notifyEmail!: DigestCadence;
  notifyPush!: DigestCadence;
  notifyNewsletter!: boolean;
  timezone!: string;
  emailVerified!: boolean;
  role!: Role;
  enabledDomains!: Domain[];
  mobileNavShortcuts!: string[];
  bio!: string | null;
  defaultReviewVisibility!: ReviewVisibility;
  defaultListVisibility!: ListVisibility;
  profileAccess!: ProfileAccess;
  locale!: Locale;
  createdAt!: string;
  onboardedAt!: string | null;
  avatarUrl!: string | null;
  acceptedTermsVersion!: string | null;
  mfaTotpEnabled!: boolean;
  mfaEmailEnabled!: boolean;
}
