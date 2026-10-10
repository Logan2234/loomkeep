import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

function config() {
  return {
    services: {
      api: {
        image: "loomkeep-api:validated",
        environment: {
          NODE_ENV: "production",
          SENTRY_ENVIRONMENT: "production",
          JWT_SECRET: "private-synthetic-secret",
        },
        ports: [],
      },
      web: {
        image: "loomkeep-web:validated",
        environment: {
          NODE_ENV: "production",
          PUBLIC_SENTRY_ENVIRONMENT: "production",
        },
        ports: [],
      },
      caddy: {},
    },
  };
}

function check(configuration, environment = "production") {
  return spawnSync(
    process.execPath,
    [
      new URL("./check-production-compose.mjs", import.meta.url).pathname,
      environment,
      "validated",
    ],
    { input: JSON.stringify(configuration), encoding: "utf8" },
  );
}

test("accepts production overrides and staging labels with production Node runtime", () => {
  assert.equal(check(config()).status, 0);
  const staging = config();
  staging.services.api.environment.SENTRY_ENVIRONMENT = "staging";
  staging.services.web.environment.PUBLIC_SENTRY_ENVIRONMENT = "staging";
  assert.equal(check(staging, "staging").status, 0);
});

test("rejects missing override, exposed ports, mismatched environments and stale images without leaking secrets", () => {
  for (const change of [
    (c) => delete c.services.api.environment.NODE_ENV,
    (c) => c.services.web.ports.push({ published: "8080" }),
    (c) =>
      (c.services.web.environment.PUBLIC_SENTRY_ENVIRONMENT = "development"),
    (c) => (c.services.api.image = "loomkeep-api:latest"),
    (c) => delete c.services.caddy,
  ]) {
    const configuration = config();
    change(configuration);
    const result = check(configuration);
    assert.notEqual(result.status, 0);
    assert.ok(!result.stderr.includes("private-synthetic-secret"));
  }
});
