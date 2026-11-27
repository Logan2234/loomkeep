import { auth } from "#lib/auth/auth.svelte.js";
import { appConfig } from "#lib/shell/config.svelte.js";
import { isDomainEnabled } from "#lib/work/domain-availability.js";
import type { HomeGate } from "./widgets";

/** The gate for the signed-in user — read it inside a `$derived` to track it. */
export const currentHomeGate = (): HomeGate => ({
  isDomainEnabled,
  socialEnabled: appConfig.socialEnabled,
  gamificationEnabled: appConfig.gamificationEnabled,
  isAdmin: auth.isAdmin,
});
