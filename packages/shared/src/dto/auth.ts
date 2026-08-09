import type {
  Domain,
  ListVisibility,
  ProfileAccess,
  ReviewVisibility,
  Role,
} from "../enums";

export interface RegisterRequestDto {
  email: string;
  password: string;
  displayName: string;
  /** Cloudflare Turnstile response token — required only when TURNSTILE_SECRET_KEY is set server-side. */
  turnstileToken?: string;
}

export interface LoginRequestDto {
  /** Email or username. */
  identifier: string;
  password: string;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface UserDto {
  id: string;
  email: string;
  /** Unique login handle (alongside email). */
  username: string;
  /** Free-form label shown around the app; not unique. */
  displayName: string;
  /** ISO date (YYYY-MM-DD), null if the user hasn't provided one. */
  birthDate: string | null;
  /** Opt-in to seeing 18+ titles; only effective when birthDate proves the account is 18+. */
  allowAdultContent: boolean;
  /** Email delivery for new episode alerts. */
  notifyEmail: boolean;
  /** Web Push delivery for new episode alerts. */
  notifyPush: boolean;
  /** Opt-in to the release newsletter (separate from notifyEmail's "new episode" alerts). */
  notifyNewsletter: boolean;
  /** Whether the account's email has been confirmed via the verification link (informational only). */
  emailVerified: boolean;
  /** Operational permission level (gates /admin). See `Role`. */
  role: Role;
  /**
   * Content domains the user keeps visible (defaults to all). Drives the nav
   * today; edited from the settings "Domaines" section. See `Domain`.
   */
  enabledDomains: Domain[];
  /**
   * Ordered ids of the mobile bottom-bar shortcuts (3–7 entries), as chosen in
   * settings. Always contains the required `"menu"` launcher. Values are
   * `MobileNavId`s from the web nav registry; gating by `enabledDomains` /
   * admin role happens at render time. See the web `navigation.ts`.
   */
  mobileNavShortcuts: string[];
  /** Short free-form profile bio (social); null when unset. */
  bio: string | null;
  /** Default audience applied to new reviews (social). See `ReviewVisibility`. */
  defaultReviewVisibility: ReviewVisibility;
  /** Default audience applied to new lists (social). See `ListVisibility`. */
  defaultListVisibility: ListVisibility;
  /** Profile access mode (social): PUBLIC/PRIVATE/GHOST ("Figurant"). */
  profileAccess: ProfileAccess;
  /**
   * UI language (Paraglide locale code, e.g. "fr"). Only "fr" ships today —
   * this is the sync-across-devices seam for a future second locale.
   */
  locale: string;
  /** ISO datetime the account was created — shown as "member since". */
  createdAt: string;
  /**
   * Path (relative to the API base) to the uploaded profile picture, or null
   * if the user hasn't set one — the client falls back to the generated
   * identicon. Includes a `?v=` cache-buster tied to the last upload.
   */
  avatarUrl: string | null;
}

export interface UpdateUserRequestDto {
  displayName?: string;
  /** ISO date (YYYY-MM-DD); pass null to clear it. */
  birthDate?: string | null;
  allowAdultContent?: boolean;
  notifyEmail?: boolean;
  notifyPush?: boolean;
  notifyNewsletter?: boolean;
  /** Content domains to keep visible; must list at least one. See `Domain`. */
  enabledDomains?: Domain[];
  /** Ordered mobile bottom-bar shortcut ids (3–7 entries, must include "menu"). */
  mobileNavShortcuts?: string[];
  /** Profile bio (social); pass null or "" to clear it. */
  bio?: string | null;
  /** Default audience for new reviews (social). */
  defaultReviewVisibility?: ReviewVisibility;
  /** Default audience for new lists (social). */
  defaultListVisibility?: ListVisibility;
  /** UI language (Paraglide locale code). Currently "fr" or "en". */
  locale?: string;
}

export interface UpdateUsernameRequestDto {
  /** Must be unique account-wide. */
  username: string;
}

export interface UsernameAvailabilityDto {
  available: boolean;
}

export interface UploadAvatarRequestDto {
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  /** Base64, no `data:...;base64,` prefix. */
  data: string;
}

export interface ChangeEmailRequestDto {
  newEmail: string;
  currentPassword: string;
}

export interface ConfirmEmailChangeRequestDto {
  code: string;
}

export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
}

export interface DeleteAccountRequestDto {
  /** Re-confirmed before wiping the account and all its data. */
  currentPassword: string;
}

export interface ForgotPasswordRequestDto {
  email: string;
}

export interface ResetPasswordRequestDto {
  token: string;
  newPassword: string;
}

export interface VerifyEmailRequestDto {
  token: string;
}

/** One active refresh-token session, i.e. one signed-in device. */
export interface SessionDto {
  id: string;
  /**
   * Refresh-JWT id. Not a secret (a random UUID); the client compares it to its
   * own token's `jti` to flag which session is the current device.
   */
  jti: string;
  /** Raw User-Agent captured at sign-in (device label); null if unknown. */
  userAgent: string | null;
  /** ISO datetime the session started (survives token rotation). */
  createdAt: string;
  /** ISO datetime of the last refresh — the session's last activity. */
  lastUsedAt: string;
}
