import type {
  AccountDeletionSummaryDto,
  AuthTokensDto,
  CalendarTokenDto,
  ChangeEmailRequestDto,
  ChangePasswordRequestDto,
  ConfirmEmailChangeRequestDto,
  CsvExportDto,
  DeleteAccountRequestDto,
  Domain,
  EntitlementDto,
  LoginRequestDto,
  LoginResponseDto,
  MfaVerifyRequestDto,
  RegisterRequestDto,
  SessionDto,
  UpdateUsernameRequestDto,
  UpdateUserRequestDto,
  UploadAvatarRequestDto,
  UserDataExportDto,
  UserDto,
  UsernameAvailabilityDto,
  WidgetTokenDto,
} from "@loomkeep/shared";
import { auth } from "../auth.svelte";
import { getLocale, isLocale, setLocale } from "../paraglide/runtime.js";
import { request } from "./core";

export async function initAuth(): Promise<void> {
  auth.loadTokens();
  if (!auth.accessToken) return;

  try {
    auth.user = await request<UserDto>("/users/me");

    // Keep the locale selected on another device. isLocale guards against a
    // stale or foreign value; no reload is needed during startup.
    if (isLocale(auth.user.locale) && auth.user.locale !== getLocale()) {
      setLocale(auth.user.locale, { reload: false });
    }
  } catch {
    auth.clear();
    return;
  }

  await loadEntitlement();
}

/** Best-effort: on failure `isPremium` stays false, the safe default. */
async function loadEntitlement(): Promise<void> {
  try {
    auth.isPremium = (
      await request<EntitlementDto>("/users/me/entitlement")
    ).isPremium;
  } catch {
    auth.isPremium = false;
  }
}

export async function register(body: RegisterRequestDto): Promise<void> {
  const result = await request<{ user: UserDto; tokens: AuthTokensDto }>(
    "/auth/register",
    {
      method: "POST",
      body,
      withAuth: false,
    },
  );
  auth.setTokens(result.tokens);
  auth.user = result.user;
  await loadEntitlement();
}

/** Sends a reset link by email, if the address matches an account. */
export const forgotPassword = (email: string): Promise<void> =>
  request("/auth/forgot-password", {
    method: "POST",
    body: { email },
    withAuth: false,
  });

export const resetPassword = (
  token: string,
  newPassword: string,
): Promise<void> =>
  request("/auth/reset-password", {
    method: "POST",
    body: { token, newPassword },
    withAuth: false,
  });

export const verifyEmail = (token: string): Promise<void> =>
  request("/auth/verify-email", {
    method: "POST",
    body: { token },
    withAuth: false,
  });

export const resendVerificationEmail = (): Promise<void> =>
  request("/auth/verification/resend", {
    method: "POST",
  });

export const unsubscribeNewsletter = (token: string): Promise<void> =>
  request("/newsletter/unsubscribe", {
    method: "POST",
    body: { token },
    withAuth: false,
  });

/** Returns the MFA challenge unresolved when the account requires a second factor. */
export async function login(body: LoginRequestDto): Promise<LoginResponseDto> {
  const result = await request<LoginResponseDto>("/auth/login", {
    method: "POST",
    body,
    withAuth: false,
  });

  if (!result.mfaRequired) {
    auth.setTokens(result.tokens);
    auth.user = result.user;
    await loadEntitlement();
  }

  return result;
}

export async function verifyMfaLogin(body: MfaVerifyRequestDto): Promise<void> {
  const result = await request<{ user: UserDto; tokens: AuthTokensDto }>(
    "/auth/mfa/verify",
    { method: "POST", body, withAuth: false },
  );
  auth.setTokens(result.tokens);
  auth.user = result.user;
  await loadEntitlement();
}

export const resendMfaEmailCode = (challengeId: string): Promise<void> =>
  request("/auth/mfa/resend-email-code", {
    method: "POST",
    body: { challengeId },
    withAuth: false,
  });

export async function updateMe(body: UpdateUserRequestDto): Promise<UserDto> {
  const user = await request<UserDto>("/users/me", { method: "PATCH", body });
  auth.user = user;
  return user;
}

/** Marks the mandatory first-run onboarding wizard as done. */
export async function completeOnboarding(): Promise<UserDto> {
  const user = await request<UserDto>("/users/me/complete-onboarding", {
    method: "POST",
  });
  auth.user = user;
  return user;
}

/** Records re-acceptance of the current CGU (LEGAL_VERSION). */
export async function acceptTerms(): Promise<UserDto> {
  const user = await request<UserDto>("/users/me/accept-terms", {
    method: "POST",
  });
  auth.user = user;
  return user;
}

export async function uploadAvatar(
  body: UploadAvatarRequestDto,
): Promise<UserDto> {
  const user = await request<UserDto>("/users/me/avatar", {
    method: "PATCH",
    body,
  });
  auth.user = user;
  return user;
}

export async function deleteAvatar(): Promise<UserDto> {
  const user = await request<UserDto>("/users/me/avatar", {
    method: "DELETE",
  });
  auth.user = user;
  return user;
}

export const changeEmail = (body: ChangeEmailRequestDto): Promise<void> =>
  request("/users/me/email", { method: "PATCH", body });

export async function confirmEmailChange(
  body: ConfirmEmailChangeRequestDto,
): Promise<UserDto> {
  const user = await request<UserDto>("/users/me/email/confirm", {
    method: "PATCH",
    body,
  });
  auth.user = user;
  return user;
}

export const changePassword = (body: ChangePasswordRequestDto): Promise<void> =>
  request("/users/me/password", { method: "PATCH", body });

export function checkUsernameAvailable(
  value: string,
): Promise<UsernameAvailabilityDto> {
  const params = new URLSearchParams({ value });
  return request(`/users/me/username-availability?${params}`);
}

export async function updateUsername(
  body: UpdateUsernameRequestDto,
): Promise<UserDto> {
  const user = await request<UserDto>("/users/me/username", {
    method: "PATCH",
    body,
  });
  auth.user = user;
  return user;
}

export const exportMyData = (): Promise<UserDataExportDto> =>
  request("/users/me/export");

// Not gated by `enabledDomains` — a hidden domain is still exportable.
export function exportMyDataCsv(domain: Domain): Promise<CsvExportDto> {
  const params = new URLSearchParams({ domain });
  return request(`/users/me/export.csv?${params}`);
}

// Creates the token on first call.
export const getCalendarToken = (): Promise<CalendarTokenDto> =>
  request("/users/me/calendar-token");

/** Issues a new calendar token, revoking any previously shared .ics link. */
export const regenerateCalendarToken = (): Promise<CalendarTokenDto> =>
  request("/users/me/calendar-token/regenerate", { method: "POST" });

// Unused, for now...
const _getWidgetToken = (): Promise<WidgetTokenDto> =>
  request("/users/me/widget-token");

export const getAccountDeletionSummary =
  (): Promise<AccountDeletionSummaryDto> =>
    request("/users/me/deletion-summary");

export async function deleteAccount(
  body: DeleteAccountRequestDto,
): Promise<void> {
  await request("/users/me", { method: "DELETE", body });
  auth.clear();
}

// --- Sessions (connected devices) ---

export const getSessions = (): Promise<SessionDto[]> =>
  request("/auth/sessions");

export const revokeSession = (id: string): Promise<void> =>
  request(`/auth/sessions/${id}`, { method: "DELETE" });

/** Revokes every session except the current device (kept via its jti). */
export function revokeOtherSessions(exceptJti: string): Promise<void> {
  const params = new URLSearchParams({ except: exceptJti });
  return request(`/auth/sessions?${params}`, { method: "DELETE" });
}

export async function logout(): Promise<void> {
  if (auth.refreshToken) {
    await request("/auth/logout", {
      method: "POST",
      body: { refreshToken: auth.refreshToken },
      withAuth: false,
    }).catch(() => undefined);
  }

  auth.clear();
}
