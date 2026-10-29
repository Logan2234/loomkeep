import { describe, expect, it } from "vitest";
import { extendCsp, integrationSources } from "./csp";

describe("integrationSources", () => {
  it("allows the origin of each configured integration where it's used", () => {
    expect(
      integrationSources({
        PUBLIC_API_URL: "https://api.example.com/api",
        PUBLIC_GLITCHTIP_WEB_DSN: "https://key@errors.example.com/2",
        PUBLIC_QUACKBACK_URL: "https://feedback.example.com/",
        PUBLIC_UMAMI_SCRIPT_URL: "https://stats.example.com/script.js",
        PUBLIC_UNLEASH_FRONTEND_URL: "https://flags.example.com/api/frontend",
      }),
    ).toEqual({
      "script-src": [
        "https://stats.example.com",
        "https://feedback.example.com",
      ],
      "connect-src": [
        "https://api.example.com",
        "wss://api.example.com",
        "https://stats.example.com",
        "https://errors.example.com",
        "https://flags.example.com",
        "https://feedback.example.com",
      ],
      "frame-src": ["https://feedback.example.com"],
    });
  });

  it("adds nothing for an unset or same-origin (relative) URL", () => {
    expect(integrationSources({ PUBLIC_API_URL: "/api" })).toEqual({
      "script-src": [],
      "connect-src": [],
      "frame-src": [],
    });
  });
});

describe("extendCsp", () => {
  const header =
    "default-src 'self'; script-src 'self' 'nonce-abc'; connect-src 'self'";

  it("appends sources to the header's directives, once each", () => {
    expect(
      extendCsp(header, {
        "script-src": ["https://stats.example.com", "'self'"],
        "connect-src": ["https://api.example.com"],
      }),
    ).toBe(
      "default-src 'self'; script-src 'self' 'nonce-abc' https://stats.example.com; connect-src 'self' https://api.example.com",
    );
  });

  // A new frame-src would replace default-src's 'self' for frames.
  it("leaves a directive the header doesn't have alone", () => {
    expect(
      extendCsp(header, { "frame-src": ["https://feedback.example.com"] }),
    ).toBe(header);
  });
});
