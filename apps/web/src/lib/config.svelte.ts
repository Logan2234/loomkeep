/**
 * Global runtime config (Svelte 5 runes), loaded once at startup from
 * `GET /api/config` (see initConfig in api/config.ts). Drives which optional
 * surfaces the app renders. Defaults to social OFF, registration OFF and erd
 * OFF so nothing optional shows until the deployment confirms its actual config.
 */
class AppConfig {
  socialEnabled = $state(false);
  registrationEnabled = $state(false);
  erdEnabled = $state(false);
}

export const appConfig = new AppConfig();
