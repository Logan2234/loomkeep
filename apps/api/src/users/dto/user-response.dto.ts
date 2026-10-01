import type {
  DigestCadence,
  Domain,
  ListVisibility,
  Locale,
  ProfileAccess,
  ReviewVisibility,
  Role,
  SpoilerSensitivity,
  UserDto,
} from "@loomkeep/shared";
import { HomeLayoutBody } from "./home-layout.dto";

export class UserResponseDto implements UserDto {
  /**
   * The account's id.
   * @example "cm1q2w3e4r5t6y7u8i9o0p1a"
   */
  id!: string;

  /**
   * Sign-in email address.
   * @example "alice.martin@example.com"
   */
  email!: string;

  /**
   * Unique handle, used in profile URLs.
   * @example "alice"
   */
  username!: string;

  /**
   * Name shown in the app.
   * @example "Alice Martin"
   */
  displayName!: string;

  /**
   * Date of birth, when given (gates adult content).
   * @example "1994-05-12"
   */
  birthDate!: string | null;

  /**
   * Whether adult titles are shown.
   * @example false
   */
  allowAdultContent!: boolean;

  /**
   * How often new-episode emails are sent.
   * @example "WEEKLY"
   */
  notifyEmail!: DigestCadence;

  /**
   * How often new-episode push notifications are sent.
   * @example "NEW_EPISODE"
   */
  notifyPush!: DigestCadence;

  /**
   * Subscribed to the release newsletter.
   * @example true
   */
  notifyNewsletter!: boolean;

  /**
   * IANA time zone, for dates and digests.
   * @example "Europe/Paris"
   */
  timezone!: string;

  /**
   * Whether the email address was confirmed.
   * @example true
   */
  emailVerified!: boolean;

  /**
   * USER, or ADMIN for the instance's administrators.
   * @example "USER"
   */
  role!: Role;

  /**
   * Domains turned on for the account.
   * @example ["MEDIA", "GAMES", "BOOKS"]
   */
  enabledDomains!: Domain[];

  /**
   * Ids of the mobile bottom-bar shortcuts, in order.
   * @example ["home", "search", "menu", "calendar", "account"]
   */
  mobileNavShortcuts!: string[];

  /**
   * The profile's bio, if any.
   * @example "Mostly anime and slow sci-fi."
   */
  bio!: string | null;

  /**
   * Visibility a new review starts with.
   * @example "PUBLIC"
   */
  defaultReviewVisibility!: ReviewVisibility;

  /**
   * Visibility a new list starts with.
   * @example "PRIVATE"
   */
  defaultListVisibility!: ListVisibility;

  /**
   * Who can open the profile: PUBLIC, PRIVATE (friends) or GHOST (nobody).
   * @example "PUBLIC"
   */
  profileAccess!: ProfileAccess;

  /**
   * Interface language.
   * @example "fr"
   */
  locale!: Locale;

  /**
   * When the account was created.
   * @example "2026-03-14T09:26:53.000Z"
   */
  createdAt!: string;

  /**
   * When the first-run setup was completed.
   * @example "2026-03-14T09:26:53.000Z"
   */
  onboardedAt!: string | null;

  /**
   * Avatar image, if one was uploaded.
   * @example "https://loomkeep.app/api/users/cm1q2w3e4r5t6y7u8i9o0p1a/avatar"
   */
  avatarUrl!: string | null;

  /**
   * Version of the terms of service last accepted.
   * @example "2026-06-01"
   */
  acceptedTermsVersion!: string | null;

  /**
   * Two-factor authentication by authenticator app is on.
   * @example true
   */
  mfaTotpEnabled!: boolean;

  /**
   * Two-factor authentication by emailed code is on.
   * @example false
   */
  mfaEmailEnabled!: boolean;

  /**
   * Level and experience hidden from others.
   * @example false
   */
  hideProgression!: boolean;

  /**
   * How spoilers are handled: AUTO (hidden until watched), ALWAYS_HIDDEN or
   * ALWAYS_REVEALED.
   * @example "AUTO"
   */
  spoilerSensitivity!: SpoilerSensitivity;

  /**
   * Order of the domains in the menu.
   * @example ["MEDIA", "BOOKS", "GAMES"]
   */
  domainOrder!: Domain[];

  /**
   * Country whose streaming offers are shown (ISO 3166-1); null for
   * automatic.
   * @example "FR"
   */
  watchRegion!: string | null;

  /**
   * TMDB ids of the streaming services the account has.
   * @example [8, 337]
   */
  watchProviderIds!: number[];

  /** The home page's widget grid; null for the default one. */
  homeLayout!: HomeLayoutBody | null;
}
