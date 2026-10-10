import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const caddyfile = readFileSync(
  new URL("../../../docker/Caddyfile", import.meta.url),
  "utf8",
);
const policy = caddyfile.match(
  /Content-Security-Policy-Report-Only "([^"]+)"/,
)![1];
const connections = policy
  .split(";")
  .map((directive) => directive.trim().split(/\s+/))
  .find(([name]) => name === "connect-src")!
  .slice(1);

describe("production connection policy", () => {
  it("allows browser error reports to reach GlitchTip", () => {
    const endpoint = new URL("https://errors.loomkeep.app/api/2/envelope/");
    expect(connections).toContain(endpoint.origin);
  });

  it("keeps Cloudflare login redirects outside the allowed connections", () => {
    expect(connections).not.toContain("https://loomkeep.cloudflareaccess.com");
    expect(connections).not.toContain("*");
    expect(connections).not.toContain("https:");
  });
});
