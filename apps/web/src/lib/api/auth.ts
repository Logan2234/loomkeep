import type {
  AuthTokensDto,
  CalendarTokenDto,
  ChangeEmailRequestDto,
  ChangePasswordRequestDto,
  ConfirmEmailChangeRequestDto,
  CsvExportDto,
  DeleteAccountRequestDto,
  Domain,
  LoginRequestDto,
  RegisterRequestDto,
  SessionDto,
  UpdateUsernameRequestDto,
  UpdateUserRequestDto,
  UploadAvatarRequestDto,
  UserDataExportDto,
  UserDto,
  UsernameAvailabilityDto,
} from "@loomkeep/shared";
import { auth } from "../auth.svelte";
import { getLocale, isLocale, setLocale } from "../paraglide/runtime.js";
import { request } from "./core";

export async function initAuth(): Promise<void> {
  auth.loadTokens();
  if (!auth.accessToken) return;

  try {
    auth.user = await request<UserDto>("/users/me");

    // Sync-across-devices seam: only "fr" exists today (isLocale guards
    // against a stale/foreign value), so this never actually fires yet —
    // wired ahead of a second locale shipping, no reload needed since we're
    // already mid-startup.
    if (isLocale(auth.user.locale) && auth.user.locale !== getLocale()) {
      setLocale(auth.user.locale, { reload: false });
    }
  } catch {
    auth.clear();
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
}

/** Sends a reset link by email, if the address matches an account. */
export function forgotPassword(email: string): Promise<void> {
  return request("/auth/forgot-password", {
    method: "POST",
    body: { email },
    withAuth: false,
  });
}

export function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  return request("/auth/reset-password", {
    method: "POST",
    body: { token, newPassword },
    withAuth: false,
  });
}

export function verifyEmail(token: string): Promise<void> {
  return request("/auth/verify-email", {
    method: "POST",
    body: { token },
    withAuth: false,
  });
}

export function resendVerificationEmail(): Promise<void> {
  return request("/auth/verification/resend", {
    method: "POST",
  });
}

export async function login(body: LoginRequestDto): Promise<void> {
  const result = await request<{ user: UserDto; tokens: AuthTokensDto }>(
    "/auth/login",
    {
      method: "POST",
      body,
      withAuth: false,
    },
  );
  auth.setTokens(result.tokens);
  auth.user = result.user;
}

export async function updateMe(body: UpdateUserRequestDto): Promise<UserDto> {
  const user = await request<UserDto>("/users/me", { method: "PATCH", body });
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

export function changeEmail(body: ChangeEmailRequestDto): Promise<void> {
  return request("/users/me/email", { method: "PATCH", body });
}

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

export function changePassword(body: ChangePasswordRequestDto): Promise<void> {
  return request("/users/me/password", { method: "PATCH", body });
}

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

/** Full portable dump of the account's data (GDPR "download my data"). */
export function exportMyData(): Promise<UserDataExportDto> {
  return request("/users/me/export");
}

// Flat per-domain CSV, meant for migrating to another tool — not gated by
// `enabledDomains` (a hidden domain is still exportable).
export function exportMyDataCsv(domain: Domain): Promise<CsvExportDto> {
  const params = new URLSearchParams({ domain });
  return request(`/users/me/export.csv?${params}`);
}

/** Fetches (creating on first call) the token for the .ics calendar subscription URL. */
export function getCalendarToken(): Promise<CalendarTokenDto> {
  return request("/users/me/calendar-token");
}

/** Issues a new calendar token, revoking any previously shared .ics link. */
export function regenerateCalendarToken(): Promise<CalendarTokenDto> {
  return request("/users/me/calendar-token/regenerate", { method: "POST" });
}

/** Permanently deletes the account and clears local auth state. */
export async function deleteAccount(
  body: DeleteAccountRequestDto,
): Promise<void> {
  await request("/users/me", { method: "DELETE", body });
  auth.clear();
}

// --- Sessions (connected devices) ---

export function getSessions(): Promise<SessionDto[]> {
  return request("/auth/sessions");
}

export function revokeSession(id: string): Promise<void> {
  return request(`/auth/sessions/${id}`, { method: "DELETE" });
}

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
