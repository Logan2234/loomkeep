import * as Sentry from "@sentry/sveltekit";

function stagingSourcemapProbe(): never {
  throw new Error("Loomkeep staging sourcemap probe");
}

export function installStagingProbe(): void {
  // Installed only by the client hook when its runtime environment is staging.
  window.loomkeepSentryProbe = async () => {
    try {
      stagingSourcemapProbe();
    } catch (error) {
      const eventId = Sentry.captureException(error, {
        tags: { component: "web", smoke: "sourcemaps" },
      });

      if (!(await Sentry.flush(5000)))
        throw new Error("The staging probe could not be flushed", {
          cause: error,
        });

      return { eventId, release: __LOOMKEEP_BUILD_SHA__ };
    }
  };
}
