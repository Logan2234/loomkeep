import type { PublicConfigDto } from "@loomkeep/shared";
import { appConfig } from "../config.svelte";
import { request } from "./core";

function getPublicConfig(): Promise<PublicConfigDto> {
  return request<PublicConfigDto>("/config", { withAuth: false });
}

/**
 * Loads the deployment's public config into the global store at startup.
 * Best-effort: on failure social stays off (the safe default).
 */
export async function initConfig(): Promise<void> {
  try {
    const config = await getPublicConfig();
    appConfig.socialEnabled = config.socialEnabled;
  } catch {
    appConfig.socialEnabled = false;
  }
}
