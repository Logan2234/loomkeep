import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import type { Locale } from "../enums";
import type { UserDto } from "./user";

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

/** Which MFA method(s) a login challenge accepts, given what the account has enabled. */
export type MfaMethod = "totp" | "email" | "webauthn" | "recovery";

/** Discriminated on `mfaRequired` — false carries the same shape `login()` always returned. */
export type LoginResponseDto =
  | { mfaRequired: true; challengeId: string; availableMethods: MfaMethod[] }
  | { mfaRequired: false; user: UserDto; tokens: AuthTokensDto };

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
}

export interface RemoveWebauthnCredentialRequestDto {
  currentPassword: string;
}

export interface RemoveWebauthnCredentialResponseDto {
  /** True when removing this credential left zero — `passwordlessEnabled` was force-disabled server-side. */
  passwordlessDisabled: boolean;
}

export interface SetPasswordlessRequestDto {
  enabled: boolean;
  currentPassword: string;
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

export interface DisableTotpRequestDto {
  currentPassword: string;
}

export interface SetEmailMfaRequestDto {
  enabled: boolean;
  currentPassword: string;
}

export interface SetEmailMfaResponseDto {
  recoveryCodes?: string[];
}

export interface RegenerateRecoveryCodesResponseDto {
  codes: string[];
}

export interface RegenerateRecoveryCodesRequestDto {
  currentPassword: string;
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
