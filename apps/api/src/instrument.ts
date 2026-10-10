// Must be imported before any other module (see main.ts) — Sentry's own
// setup instructions for Node.
import {
  createSentryEventFilter,
  scrubSentryBreadcrumb,
} from "@loomkeep/shared/observability";
import * as Sentry from "@sentry/node";

const dsn = process.env.GLITCHTIP_API_DSN;

// Production only, and only if a DSN was actually configured — same "empty
// disables it" convention as every other optional integration (TMDB_API_
// TOKEN, VAPID_*, SMTP_*...). Reports to GlitchTip (see
// docker-compose.glitchtip.yml), a self-hosted Sentry-API-compatible error
// tracker, not sentry.io.
if (process.env.NODE_ENV === "production" && dsn) {
  Sentry.init({
    dsn,
    release:
      process.env.GIT_SHA && process.env.GIT_SHA !== "unknown"
        ? process.env.GIT_SHA
        : undefined,
    environment: process.env.SENTRY_ENVIRONMENT ?? "production",
    dist: process.arch,
    beforeSend: createSentryEventFilter(),
    beforeBreadcrumb: scrubSentryBreadcrumb,
    // GlitchTip's supported workflow is error reporting, not performance tracing.
    tracesSampleRate: 0,
    // SDK v11 collects these by default. Auth, MFA, imports and private
    // messages must not become error-tracker payloads after the upgrade.
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
    integrations: (integrations) => [
      // Process sessions are separate from HTTP sessions and become reportable
      // as soon as a release is configured (including GitHub's inferred SHA).
      ...integrations.filter(
        (integration) =>
          integration.name !== "ProcessSession" &&
          integration.name !== "Dedupe",
      ),
      // SDK v11 renamed trackIncomingRequestsAsSessions to sessions.
      // GlitchTip does not support Sessions/Release Health.
      Sentry.httpIntegration({ sessions: false }),
      // Match the release file names uploaded from the Docker filesystem.
      Sentry.rewriteFramesIntegration({ root: "/app", prefix: "app:///" }),
    ],
  });
}
