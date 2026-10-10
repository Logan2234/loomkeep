import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const caddyfile = readFileSync(
  new URL("../../../docker/Caddyfile", import.meta.url),
  "utf8",
);
const policy = caddyfile.match(
  /Content-Security-Policy-Report-Only "([^"]+)"/,
)![1];
const directives = new Map(
  policy.split(";").map((directive) => {
    const [name, ...sources] = directive.trim().split(/\s+/);
    return [name, sources];
  }),
);

function allowedSources(directive: string): string[] {
  return (
    directives.get(directive) ??
    (directive === "script-src-elem"
      ? directives.get("script-src")
      : undefined) ??
    directives.get("default-src")!
  );
}

describe("production integration policy", () => {
  it.each([
    ["connect-src", "https://flags.loomkeep.app/api/frontend?sessionId=1"],
    ["connect-src", "https://flags.loomkeep.app/api/frontend/client/metrics"],
    ["script-src-elem", "https://feedback.loomkeep.app/api/widget/sdk.js"],
    ["connect-src", "https://feedback.loomkeep.app/api/widget/config.json"],
    ["frame-src", "https://feedback.loomkeep.app/widget"],
    ["connect-src", "https://errors.loomkeep.app/api/2/envelope/"],
  ])("allows %s requests to %s", (directive, endpoint) => {
    expect(allowedSources(directive)).toContain(new URL(endpoint).origin);
  });

  it("limits widget frames to the app and the feedback service", () => {
    expect(allowedSources("frame-src")).toEqual([
      "'self'",
      "https://feedback.loomkeep.app",
    ]);
    expect(allowedSources("connect-src")).not.toContain(
      "https://loomkeep.cloudflareaccess.com",
    );
  });
});
