import type { UserDto } from "./user";

export interface RegisterRequestDto {
  email: string;
  password: string;
  displayName: string;
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
export type MfaMethod = "totp" | "email" | "recovery";

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
