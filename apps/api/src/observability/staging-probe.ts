// Explicit CLI only: there is no public HTTP endpoint that crashes the API.
import * as Sentry from "@sentry/node";
import "../instrument.js";

function stagingSourcemapProbe(): never {
  throw new Error("Loomkeep staging sourcemap probe");
}

async function main(): Promise<void> {
  if (process.env.SENTRY_ENVIRONMENT !== "staging" || !Sentry.isInitialized()) {
    throw new Error(
      "The sourcemap probe requires staging with error reporting enabled",
    );
  }

  try {
    stagingSourcemapProbe();
  } catch (error) {
    const eventId = Sentry.captureException(error, {
      tags: { component: "api", smoke: "sourcemaps" },
    });

    if (!(await Sentry.flush(5000)))
      throw new Error("The staging probe could not be flushed", {
        cause: error,
      });
    console.warn(JSON.stringify({ eventId, release: process.env.GIT_SHA }));
  }

  await Sentry.close(5000);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
