import { readFileSync } from "node:fs";

// Consume the resolved Compose configuration without printing secret values.
const config = JSON.parse(readFileSync(0, "utf8"));
const environment = process.argv[2] ?? "production";
const imageTag = process.argv[3];

for (const component of ["api", "web"]) {
  const service = config.services?.[component];

  if (service?.environment?.NODE_ENV !== "production") {
    throw new Error(
      `${component}: production override is missing (NODE_ENV must be production)`,
    );
  }

  if ((service.ports ?? []).some((port) => port.published)) {
    throw new Error(
      `${component}: production override must remove public API/web ports`,
    );
  }

  const sentryEnvironment =
    component === "api" ? "SENTRY_ENVIRONMENT" : "PUBLIC_SENTRY_ENVIRONMENT";

  if (service.environment[sentryEnvironment] !== environment) {
    throw new Error(
      `${component}: error reporting environment must match ${environment}`,
    );
  }

  if (imageTag && !service.image?.endsWith(`:${imageTag}`)) {
    throw new Error(
      `${component}: image must match the validated deployment tag`,
    );
  }
}

if (!config.services?.caddy)
  throw new Error("Production reverse proxy is missing");
