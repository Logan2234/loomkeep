import { auth } from "$lib/auth.svelte";

/**
 * Neither release summary is on, by email or by push: a release reminder or
 * a show's episode alerts would change nothing the user receives.
 */
export const releaseDigestOff = () =>
  auth.user?.notifyEmail === "DISABLED" && auth.user?.notifyPush === "DISABLED";
