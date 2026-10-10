// Must be imported before any other module (see main.ts) — Sentry's own
// setup instructions for Node.
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
    integrations: [
      // SDK v11 renamed trackIncomingRequestsAsSessions to sessions.
      // GlitchTip does not support Sessions/Release Health.
      Sentry.httpIntegration({ sessions: false }),
    ],
  });
}
