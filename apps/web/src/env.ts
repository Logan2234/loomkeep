import { defineEnvVars } from "@sveltejs/kit/env";

const optionalString = (value: string | undefined) => value;

export const variables = defineEnvVars({
  PUBLIC_API_URL: { public: true, schema: optionalString },
  PUBLIC_GLITCHTIP_WEB_DSN: { public: true, schema: optionalString },
  PUBLIC_IS_BETA: { public: true, schema: optionalString },
  PUBLIC_SIMKL_CLIENT_ID: { public: true, schema: optionalString },
  PUBLIC_TURNSTILE_SITE_KEY: { public: true, schema: optionalString },
  PUBLIC_UMAMI_SCRIPT_URL: { public: true, schema: optionalString },
  PUBLIC_UMAMI_WEBSITE_ID: { public: true, schema: optionalString },
  PUBLIC_UNLEASH_FRONTEND_TOKEN: { public: true, schema: optionalString },
  PUBLIC_UNLEASH_FRONTEND_URL: { public: true, schema: optionalString },
});
