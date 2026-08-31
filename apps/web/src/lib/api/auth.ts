import type {
  AccountDeletionSummaryDto,
  ChangeEmailRequestDto,
  ChangePasswordRequestDto,
  ConfirmEmailChangeRequestDto,
  CsvExportDto,
  DeleteAccountRequestDto,
  Domain,
  LoginRequestDto,
  LoginResponseDto,
  MfaVerifyRequestDto,
  RegisterRequestDto,
  UpdateUsernameRequestDto,
  UpdateUserRequestDto,
  UploadAvatarRequestDto,
  UserDataExportDto,
  UserDto,
  WidgetTokenDto,
} from "@loomkeep/shared";
import { auth } from "../auth.svelte";
import { getLocale, isLocale, setLocale } from "../paraglide/runtime.js";
import { request } from "./core";
import { typedRequest } from "./generated/typed-request";

export async function initAuth(): Promise<void> {
  auth.loadTokens();
  if (!auth.accessToken) return;

  try {
    auth.user = await typedRequest("/users/me");

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
    auth.isPremium = (await typedRequest("/users/me/entitlement")).isPremium;
  } catch {
    auth.isPremium = false;
  }
}

export async function register(body: RegisterRequestDto): Promise<void> {
  const result = await typedRequest("/auth/register", {
    method: "POST",
    body,
    withAuth: false,
  });
  auth.setTokens(result.tokens);
  auth.user = result.user;
  await loadEntitlement();
}

/** Sends a reset link by email, if the address matches an account. */
export const forgotPassword = (email: string): Promise<void> =>
  typedRequest("/auth/forgot-password", {
    method: "POST",
    body: { email },
    withAuth: false,
  });

export const resetPassword = (
  token: string,
  newPassword: string,
): Promise<void> =>
  typedRequest("/auth/reset-password", {
    method: "POST",
    body: { token, newPassword },
    withAuth: false,
  });

export const verifyEmail = (token: string): Promise<void> =>
  typedRequest("/auth/verify-email", {
    method: "POST",
    body: { token },
    withAuth: false,
  });

export const resendVerificationEmail = (): Promise<void> =>
  typedRequest("/auth/verification/resend", {
    method: "POST",
  });

export const unsubscribeNewsletter = (token: string): Promise<void> =>
  typedRequest("/newsletter/unsubscribe", {
    method: "POST",
    body: { token },
    withAuth: false,
  });

/** Returns the MFA challenge unresolved when the account requires a second factor. */
export async function login(body: LoginRequestDto): Promise<LoginResponseDto> {
  const result = await typedRequest("/auth/login", {
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
  const result = await typedRequest("/auth/mfa/verify", {
    method: "POST",
    body,
    withAuth: false,
  });
  auth.setTokens(result.tokens);
  auth.user = result.user;
  await loadEntitlement();
}

export const resendMfaEmailCode = (challengeId: string): Promise<void> =>
  typedRequest("/auth/mfa/resend-email-code", {
    method: "POST",
    body: { challengeId },
    withAuth: false,
  });

export async function updateMe(body: UpdateUserRequestDto): Promise<UserDto> {
  const user = await typedRequest("/users/me", { method: "PATCH", body });
  auth.user = user;
  return user;
}

/** Marks the mandatory first-run onboarding wizard as done. */
export async function completeOnboarding(): Promise<UserDto> {
  const user = await typedRequest("/users/me/complete-onboarding", {
    method: "POST",
  });
  auth.user = user;
  return user;
}

/** Records re-acceptance of the current CGU (LEGAL_VERSION). */
export async function acceptTerms(): Promise<UserDto> {
  const user = await typedRequest("/users/me/accept-terms", {
    method: "POST",
  });
  auth.user = user;
  return user;
}

export async function uploadAvatar(
  body: UploadAvatarRequestDto,
): Promise<UserDto> {
  const user = await typedRequest("/users/me/avatar", {
    method: "PATCH",
    body,
  });
  auth.user = user;
  return user;
}

export async function deleteAvatar(): Promise<UserDto> {
  const user = await typedRequest("/users/me/avatar", {
    method: "DELETE",
  });
  auth.user = user;
  return user;
}

export const changeEmail = (body: ChangeEmailRequestDto): Promise<void> =>
  typedRequest("/users/me/email", { method: "PATCH", body });

export async function confirmEmailChange(
  body: ConfirmEmailChangeRequestDto,
): Promise<UserDto> {
  const user = await typedRequest("/users/me/email/confirm", {
    method: "PATCH",
    body,
  });
  auth.user = user;
  return user;
}

export const changePassword = (body: ChangePasswordRequestDto): Promise<void> =>
  typedRequest("/users/me/password", { method: "PATCH", body });

// Not migrated to typedRequest: query-string params aren't supported by the
// wrapper yet (only path params, see generated/typed-request.ts) — path
// typing and response typing are still both correct here via `request<T>`.
export function checkUsernameAvailable(
  value: string,
): ReturnType<typeof request<{ available: boolean }>> {
  const params = new URLSearchParams({ value });
  return request(`/users/me/username-availability?${params}`);
}

export async function updateUsername(
  body: UpdateUsernameRequestDto,
): Promise<UserDto> {
  const user = await typedRequest("/users/me/username", {
    method: "PATCH",
    body,
  });
  auth.user = user;
  return user;
}

// Not migrated: UserDataExportDto is too deeply nested to type for now (see
// the comment on UsersController#exportData) — the API response itself is
// still untyped in Swagger, so there's nothing for typedRequest to read yet.
export const exportMyData = (): Promise<UserDataExportDto> =>
  request("/users/me/export");

// Not migrated: query-string params aren't supported by typedRequest yet.
// Not gated by `enabledDomains` — a hidden domain is still exportable.
export function exportMyDataCsv(domain: Domain): Promise<CsvExportDto> {
  const params = new URLSearchParams({ domain });
  return request(`/users/me/export.csv?${params}`);
}

// Creates the token on first call.
export const getCalendarToken = () => typedRequest("/users/me/calendar-token");

/** Issues a new calendar token, revoking any previously shared .ics link. */
export const regenerateCalendarToken = () =>
  typedRequest("/users/me/calendar-token/regenerate", { method: "POST" });

// Unused, for now...
const _getWidgetToken = (): Promise<WidgetTokenDto> =>
  typedRequest("/users/me/widget-token");

export const getAccountDeletionSummary =
  (): Promise<AccountDeletionSummaryDto> =>
    typedRequest("/users/me/deletion-summary");

export async function deleteAccount(
  body: DeleteAccountRequestDto,
): Promise<void> {
  await typedRequest("/users/me", { method: "DELETE", body });
  auth.clear();
}

// --- Sessions (connected devices) ---

export const getSessions = () => typedRequest("/auth/sessions");

export const revokeSession = (id: string): Promise<void> =>
  typedRequest("/auth/sessions/{id}", { method: "DELETE", params: { id } });

// Not migrated: query-string params aren't supported by typedRequest yet.
/** Revokes every session except the current device (kept via its jti). */
export function revokeOtherSessions(exceptJti: string): Promise<void> {
  const params = new URLSearchParams({ except: exceptJti });
  return request(`/auth/sessions?${params}`, { method: "DELETE" });
}

export async function logout(): Promise<void> {
  if (auth.refreshToken) {
    await typedRequest("/auth/logout", {
      method: "POST",
      body: { refreshToken: auth.refreshToken },
      withAuth: false,
    }).catch(() => undefined);
  }

  auth.clear();
}
