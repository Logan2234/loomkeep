import { registerServiceWorker } from "#lib/native/service-worker.js";
import * as env from "$app/env/public";
import * as Sentry from "@sentry/sveltekit";

registerServiceWorker();

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
      integrations.filter(
        (integration) =>
          integration.name !== "BrowserTracing" &&
          integration.name !== "BrowserSession",
      ),
  });
}

export const handleError = Sentry.handleErrorWithSentry();

// A tab opened before a deploy asks for code the new version no longer serves
// (the service worker drops it as it takes over): the chat field would never
// load its editor. Reloading picks the current version up — once a minute at
// most, should the code really be missing.
const RELOADED_AT = "loomkeep:preload-reload";
window.addEventListener("vite:preloadError", () => {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT));
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    return;
  }

  location.reload();
});
