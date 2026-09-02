import { appConfig } from "../config.svelte";
import { typedRequest } from "./generated/typed-request";

const getPublicConfig = () => typedRequest("/config", { withAuth: false });

/**
 * Loads the deployment's public config into the global store at startup.
 * Best-effort: on failure everything optional stays off (the safe default).
 */
export async function initConfig(): Promise<void> {
  try {
    const config = await getPublicConfig();
    appConfig.socialEnabled = config.socialEnabled;
    appConfig.gamificationEnabled = config.gamificationEnabled;
    appConfig.registrationEnabled = config.registrationEnabled;
    appConfig.erdEnabled = config.erdEnabled;
    appConfig.adminMfaEnforced = config.adminMfaEnforced;
    appConfig.version = config.version;
    appConfig.gitSha = config.gitSha;
  } catch {
    appConfig.socialEnabled = false;
    appConfig.gamificationEnabled = false;
    appConfig.registrationEnabled = false;
    appConfig.erdEnabled = false;
    appConfig.adminMfaEnforced = true;
    appConfig.version = "";
    appConfig.gitSha = "";
  }
}
