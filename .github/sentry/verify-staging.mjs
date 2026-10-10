import { setTimeout as delay } from "node:timers/promises";

const {
  SENTRY_URL,
  SENTRY_ORG,
  SENTRY_AUTH_TOKEN,
  SENTRY_API_PROJECT,
  SENTRY_WEB_PROJECT,
  RELEASE,
  API_EVENT_ID,
  WEB_EVENT_ID,
} = process.env;

if (
  ![
    SENTRY_URL,
    SENTRY_ORG,
    SENTRY_AUTH_TOKEN,
    SENTRY_API_PROJECT,
    SENTRY_WEB_PROJECT,
    RELEASE,
    API_EVENT_ID,
    WEB_EVENT_ID,
  ].every(Boolean)
) {
  throw new Error(
    "Set the tracker URL, organization, token, projects, release and both staging event IDs",
  );
}

if (!/^[a-f0-9]{40}$/.test(RELEASE))
  throw new Error("Use the full deployed build SHA");

for (const [component, project, eventId, source] of [
  [
    "api",
    SENTRY_API_PROJECT,
    API_EVENT_ID,
    "src/observability/staging-probe.ts",
  ],
  [
    "web",
    SENTRY_WEB_PROJECT,
    WEB_EVENT_ID,
    "src/lib/observability/staging-probe.ts",
  ],
]) {
  if (!/^[a-f0-9]{32}$/.test(eventId))
    throw new Error(`Invalid ${component} event ID`);
  let verified = false;

  for (let attempt = 0; attempt < 30; attempt++) {
    const endpoint = new URL(
      `api/0/projects/${encodeURIComponent(SENTRY_ORG)}/${encodeURIComponent(project)}/events/${eventId}/`,
      SENTRY_URL.endsWith("/") ? SENTRY_URL : `${SENTRY_URL}/`,
    );
    const response = await fetch(endpoint, {
      headers: { authorization: `Bearer ${SENTRY_AUTH_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 401 || response.status === 403)
      throw new Error("The verification token cannot read project events");
    if (!response.ok && response.status !== 404)
      throw new Error(`Tracker returned HTTP ${response.status}`);

    if (response.ok) {
      const event = await response.json();
      const release =
        typeof event.release === "string"
          ? event.release
          : event.release?.version;
      const environment =
        event.environment ??
        event.tags?.find((tag) => tag.key === "environment")?.value;

      if (release !== RELEASE || environment !== "staging")
        throw new Error(
          `${component}: release/environment does not match the staged build`,
        );
      const exception =
        event.exception ??
        event.entries?.find((entry) => entry.type === "exception")?.data;
      const frames =
        exception?.values?.flatMap((value) => value.stacktrace?.frames ?? []) ??
        [];
      verified = frames.some((frame) => {
        const filename =
          frame.filename ?? frame.absPath ?? frame.abs_path ?? "";
        const context =
          frame.context_line ??
          frame.contextLine ??
          frame.context?.find(
            ([line]) => line === (frame.lineNo ?? frame.lineno),
          )?.[1];
        return (
          filename.endsWith(source) &&
          typeof context === "string" &&
          context.includes("Loomkeep staging sourcemap probe")
        );
      });

      if (verified) break;
    }

    await delay(2000);
  }

  if (!verified)
    throw new Error(
      `${component}: no readable TypeScript probe frame was resolved`,
    );
  console.warn(
    `${component}: staging release and TypeScript source context verified`,
  );
}
