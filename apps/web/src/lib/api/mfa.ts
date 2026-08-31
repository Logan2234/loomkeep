import type {
  ConfirmTotpRequestDto,
  DisableTotpRequestDto,
  SetEmailMfaRequestDto,
} from "@loomkeep/shared";
import { auth } from "../auth.svelte";
import { typedRequest } from "./generated/typed-request";

export const getMfaStatus = () => typedRequest("/users/me/mfa");

export const setupTotp = () =>
  typedRequest("/users/me/mfa/totp/setup", { method: "POST" });

export async function confirmTotp(body: ConfirmTotpRequestDto) {
  const result = await typedRequest("/users/me/mfa/totp/confirm", {
    method: "POST",
    body,
  });
  if (auth.user) auth.user = { ...auth.user, mfaTotpEnabled: true };
  return result;
}

export async function disableTotp(body: DisableTotpRequestDto): Promise<void> {
  await typedRequest("/users/me/mfa/totp/disable", { method: "POST", body });
  if (auth.user) auth.user = { ...auth.user, mfaTotpEnabled: false };
}

export async function setEmailMfa(body: SetEmailMfaRequestDto) {
  const result = await typedRequest("/users/me/mfa/email", {
    method: "PATCH",
    body,
  });
  if (auth.user) auth.user = { ...auth.user, mfaEmailEnabled: body.enabled };
  return result;
}

export const regenerateRecoveryCodes = () =>
  typedRequest("/users/me/mfa/recovery-codes/regenerate", { method: "POST" });
