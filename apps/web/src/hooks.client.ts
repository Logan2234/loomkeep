import * as env from "$app/env/public";
import * as Sentry from "@sentry/sveltekit";

const dsn = env.PUBLIC_GLITCHTIP_WEB_DSN;

// Empty (the default outside the prod Docker deployment) = never
// initializes, same convention as every other optional env-gated
// integration. Reports to GlitchTip (see docker-compose.glitchtip.yml), not
// sentry.io. Errors only, no tracing/replay — GlitchTip only partially
// supports performance tracing and doesn't implement session replay at all
// (events would just be silently dropped).
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    // A zero sample rate still installs tracing, which reads removed Kit stores.
    integrations: (integrations) =>
      integrations.filter(
        (integration) => integration.name !== "BrowserTracing",
      ),
  });
}

export const handleError = Sentry.handleErrorWithSentry();
