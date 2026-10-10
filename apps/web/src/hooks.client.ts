import { installStagingProbe } from "#lib/observability/staging-probe.js";
import * as env from "$app/env/public";
import {
  createSentryEventFilter,
  scrubSentryBreadcrumb,
} from "@loomkeep/shared/observability";
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
    release:
      __LOOMKEEP_BUILD_SHA__ === "unknown" ? undefined : __LOOMKEEP_BUILD_SHA__,
    environment: env.PUBLIC_SENTRY_ENVIRONMENT ?? "development",
    beforeSend: createSentryEventFilter(),
    beforeBreadcrumb: scrubSentryBreadcrumb,
    tracesSampleRate: 0,
    // SDK v11's defaults include request bodies, cookies and user data.
    // Keep authentication and private content out of collected telemetry.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      genAI: { inputs: false, outputs: false },
      queues: false,
      graphQL: { document: false, variables: false },
      stackFrameVariables: false,
    },
    // A zero sample rate still installs tracing, which reads removed Kit stores.
    // GlitchTip also does not implement the browser sessions envelope.
    integrations: (integrations) =>
      integrations
        .filter(
          (integration) =>
            integration.name !== "BrowserTracing" &&
            integration.name !== "BrowserSession",
        )
        .map((integration): Sentry.Integration => {
          const processEvent = integration.processEvent;

          if (integration.name !== "Dedupe" || !processEvent)
            return integration;

          return {
            ...integration,
            // Do not collapse distinct HTTP requests with identical stacks;
            // retain default deduplication for errors without a server ID.
            processEvent: (event, hint, client) =>
              typeof event.contexts?.loomkeep?.requestId === "string"
                ? event
                : processEvent(event, hint, client),
          };
        }),
  });

  if (env.PUBLIC_SENTRY_ENVIRONMENT === "staging") installStagingProbe();
}

export const handleError = Sentry.handleErrorWithSentry();
