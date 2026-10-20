import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import type { SecurityEventType } from "../enums";
import type { Locale } from "../locale";
import type { UserDto } from "./user";

export const OTP_CODE_LENGTH = 6;
export const RECOVERY_CODE_LENGTH = 10;

export interface RegisterRequestDto {
  email: string;
  password: string;
  displayName: string;
  /** Locale selected on the signup page. Older clients may omit it. */
  locale?: Locale;
  /** Must be `true` — the account isn't created otherwise. */
  acceptedTerms: boolean;
  /** Must be `true` — self-certification of the 15+ minimum age, the account isn't created otherwise. */
  certifiedAge: boolean;
  /** Cloudflare Turnstile response token — required only when TURNSTILE_SECRET_KEY is set server-side. */
  turnstileToken?: string;
  /** Raw token from an invitation link — lets the sign-up through even while registration is closed. */
  inviteToken?: string;
}

export interface InvitationPreviewRequestDto {
  token: string;
}

/** What the sign-up page shows about a still-redeemable invitation. */
export interface InvitationPreviewDto {
  /** Display name of whoever sent it — null once that account is deleted. */
  inviterName: string | null;
  /** When set, the only address the account can be created with. */
  email: string | null;
  expiresAt: string;
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

/** Successful registration and completed MFA-login response. */
export interface AuthResultResponseDto {
  user: UserDto;
}

export interface ChangeEmailRequestDto {
  newEmail: string;
}

export interface ConfirmEmailChangeRequestDto {
  code: string;
}

export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
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

/** Which MFA method(s) a login challenge accepts, given what the account has enabled. */
export type MfaMethod = "totp" | "email" | "webauthn" | "recovery";

/** Discriminated on `mfaRequired` — false carries the same shape `login()` always returned. */
export type LoginResponseDto =
  | { mfaRequired: true; challengeId: string; availableMethods: MfaMethod[] }
  | { mfaRequired: false; user: UserDto };

export interface MfaVerifyRequestDto {
  challengeId: string;
  /** A TOTP code, the emailed code, or a recovery code — the server tries each allowed method. */
  code: string;
}

export interface ResendMfaEmailCodeRequestDto {
  challengeId: string;
}

export interface MfaStatusDto {
  totpEnabled: boolean;
  emailEnabled: boolean;
  recoveryCodesRemaining: number;
  webauthnCredentials: WebauthnCredentialDto[];
  /** Only ever true while `webauthnCredentials` is non-empty. */
  passwordlessEnabled: boolean;
}

export interface WebauthnCredentialDto {
  id: string;
  name: string;
  deviceType: "singleDevice" | "multiDevice";
  createdAt: string;
  lastUsedAt: string | null;
}

/** Step 1 of adding a passkey from settings: server-generated attestation challenge. */
export interface WebauthnRegistrationOptionsDto {
  webauthnChallengeId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
}

export interface WebauthnRegistrationVerifyRequestDto {
  webauthnChallengeId: string;
  response: RegistrationResponseJSON;
  /** User-chosen label, e.g. "YubiKey bureau". */
  name: string;
}

export interface WebauthnRegistrationVerifyResponseDto {
  credential: WebauthnCredentialDto;
  /** Only present when this is the account's first-ever MFA method — same convention as ConfirmTotpResponseDto. */
  recoveryCodes?: string[];
}

export interface RemoveWebauthnCredentialResponseDto {
  /** True when removing this credential left zero — `passwordlessEnabled` was force-disabled server-side. */
  passwordlessDisabled: boolean;
}

export interface RenameWebauthnCredentialRequestDto {
  /** The new user-chosen label — no identity confirmation, this isn't a security-changing action. */
  name: string;
}

export interface RenameWebauthnCredentialResponseDto {
  credential: WebauthnCredentialDto;
}

export interface SetPasswordlessRequestDto {
  enabled: boolean;
}

/** Step 1 of the WebAuthn 2nd factor at login: given a pending `MfaLoginChallenge`, the assertion challenge. */
export interface WebauthnMfaOptionsRequestDto {
  challengeId: string;
}

export interface WebauthnMfaOptionsResponseDto {
  webauthnChallengeId: string;
  options: PublicKeyCredentialRequestOptionsJSON;
}

export interface WebauthnMfaVerifyRequestDto {
  webauthnChallengeId: string;
  response: AuthenticationResponseJSON;
}

/** Step 1 of a passwordless login: no password involved, so the account is looked up by identifier alone. */
export interface WebauthnLoginOptionsRequestDto {
  identifier: string;
}

export interface WebauthnLoginOptionsResponseDto {
  webauthnChallengeId: string;
  options: PublicKeyCredentialRequestOptionsJSON;
}

export interface WebauthnLoginVerifyRequestDto {
  webauthnChallengeId: string;
  response: AuthenticationResponseJSON;
}

export interface TotpSetupDto {
  otpauthUri: string;
  /** Shown as a "can't scan? enter manually" fallback. */
  secret: string;
}

export interface ConfirmTotpRequestDto {
  code: string;
}

/** `recoveryCodes` is only present when this call generated the account's first-ever batch. */
export interface ConfirmTotpResponseDto {
  recoveryCodes?: string[];
}

export interface SetEmailMfaRequestDto {
  enabled: boolean;
}

export interface SetEmailMfaResponseDto {
  recoveryCodes?: string[];
}

export interface RegenerateRecoveryCodesResponseDto {
  codes: string[];
}

/** One active refresh-token session, i.e. one signed-in device. */
export interface SessionDto {
  id: string;
  /**
   * Refresh-JWT id. Not a secret (a random UUID); retained for session audit
   * and server-side management, never read from a browser token.
   */
  jti: string;
  /** True only for the session identified by the signed access cookie. */
  isCurrent: boolean;
  /** Raw User-Agent captured at sign-in (device label); null if unknown. */
  userAgent: string | null;
  /** ISO datetime the session started (survives token rotation). */
  createdAt: string;
  /** ISO datetime of the last refresh — the session's last activity. */
  lastUsedAt: string;
}

/** One entry of the account's own security history, in the settings. */
export interface AccountSecurityEventDto {
  id: string;
  type: SecurityEventType;
  /** Language-neutral context: the old → new email, a security key's name. */
  detail: string | null;
  /** Null when unknown, e.g. on events recorded before IPs were kept. */
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

/**
 * How the signed-in user can prove it's them again before a sensitive action,
 * strongest first. Recovery and e-mail codes don't count: the first are kept
 * for a lost factor, the second land in a mailbox a session thief may hold.
 */
export const REAUTH_METHODS = ["webauthn", "totp", "password"] as const;
export type ReauthMethod = (typeof REAUTH_METHODS)[number];

/** How long a confirmation lets sensitive actions through on its session. */
export const REAUTH_WINDOW_MS = 10 * 60 * 1000;

/** `GET /auth/reauth`. */
export interface ReauthStatusDto {
  /** The methods the account has, strongest first; `password` is always there. */
  methods: ReauthMethod[];
  /** When this session's confirmation runs out; null when there's none. */
  confirmedUntil: string | null;
}

/** `POST /auth/reauth`: the proof for one method. */
export interface ReauthRequestDto {
  method: ReauthMethod;
  /** With `password`. */
  password?: string;
  /** With `totp`: the authenticator app's current code. */
  code?: string;
  /** With `webauthn`: from `POST /auth/reauth/webauthn-options`. */
  webauthnChallengeId?: string;
  /** With `webauthn`: the browser's assertion. */
  response?: AuthenticationResponseJSON;
}

export interface ReauthResultDto {
  confirmedUntil: string;
}
