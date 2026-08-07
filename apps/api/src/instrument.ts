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
    tracesSampleRate: 0.01,
    integrations: [
      // GlitchTip does not support Sessions/Release Health — the option
      // used to be a top-level `autoSessionTracking: false`, but that was
      // removed in the SDK's v9; this is the current equivalent.
      Sentry.httpIntegration({ trackIncomingRequestsAsSessions: false }),
    ],
  });
}
