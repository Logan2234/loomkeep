import type {
  ConfirmTotpRequestDto,
  ConfirmTotpResponseDto,
  DisableTotpRequestDto,
  MfaStatusDto,
  RegenerateRecoveryCodesResponseDto,
  SetEmailMfaRequestDto,
  SetEmailMfaResponseDto,
  TotpSetupDto,
} from "@loomkeep/shared";
import { auth } from "../auth.svelte";
import { request } from "./core";

export const getMfaStatus = (): Promise<MfaStatusDto> =>
  request("/users/me/mfa");

export const setupTotp = (): Promise<TotpSetupDto> =>
  request("/users/me/mfa/totp/setup", { method: "POST" });

export async function confirmTotp(
  body: ConfirmTotpRequestDto,
): Promise<ConfirmTotpResponseDto> {
  const result = await request<ConfirmTotpResponseDto>(
    "/users/me/mfa/totp/confirm",
    { method: "POST", body },
  );
  if (auth.user) auth.user = { ...auth.user, mfaTotpEnabled: true };
  return result;
}

export async function disableTotp(body: DisableTotpRequestDto): Promise<void> {
  await request("/users/me/mfa/totp/disable", { method: "POST", body });
  if (auth.user) auth.user = { ...auth.user, mfaTotpEnabled: false };
}

export async function setEmailMfa(
  body: SetEmailMfaRequestDto,
): Promise<SetEmailMfaResponseDto> {
  const result = await request<SetEmailMfaResponseDto>("/users/me/mfa/email", {
    method: "PATCH",
    body,
  });
  if (auth.user) auth.user = { ...auth.user, mfaEmailEnabled: body.enabled };
  return result;
}

export const regenerateRecoveryCodes =
  (): Promise<RegenerateRecoveryCodesResponseDto> =>
    request("/users/me/mfa/recovery-codes/regenerate", { method: "POST" });
