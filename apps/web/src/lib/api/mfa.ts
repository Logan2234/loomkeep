import type {
  ConfirmTotpRequestDto,
  DisableTotpRequestDto,
  RegenerateRecoveryCodesRequestDto,
  RemoveWebauthnCredentialRequestDto,
  SetEmailMfaRequestDto,
  SetPasswordlessRequestDto,
  WebauthnRegistrationVerifyResponseDto,
} from "@loomkeep/shared";
import {
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/browser";
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

export const regenerateRecoveryCodes = (
  body: RegenerateRecoveryCodesRequestDto,
) =>
  typedRequest("/users/me/mfa/recovery-codes/regenerate", {
    method: "POST",
    body,
  });

/** Runs the full "add a passkey" ceremony: fetch options, prompt the browser, verify. */
export async function registerWebauthnCredential(
  name: string,
): Promise<WebauthnRegistrationVerifyResponseDto> {
  const { webauthnChallengeId, options } = await typedRequest(
    "/users/me/mfa/webauthn/register-options",
    { method: "POST" },
  );
  const response = await startRegistration({
    // Swagger reflects this opaque field as `{}` — see auth.ts's identical cast.
    optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON,
  });
  return typedRequest("/users/me/mfa/webauthn/register-verify", {
    method: "POST",
    body: { webauthnChallengeId, response, name },
  });
}

export const removeWebauthnCredential = (
  credentialId: string,
  body: RemoveWebauthnCredentialRequestDto,
) =>
  typedRequest("/users/me/mfa/webauthn/{credentialId}", {
    method: "DELETE",
    params: { credentialId },
    body,
  });

export const setPasswordless = (body: SetPasswordlessRequestDto) =>
  typedRequest("/users/me/mfa/passwordless", { method: "PATCH", body });
