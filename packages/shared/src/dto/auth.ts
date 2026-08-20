export interface RegisterRequestDto {
  email: string;
  password: string;
  displayName: string;
  /** Must be `true` — the account isn't created otherwise. */
  acceptedTerms: boolean;
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
