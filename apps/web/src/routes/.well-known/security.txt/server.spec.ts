import type { RequestEvent } from "@sveltejs/kit";
import { describe, expect, it } from "vitest";
import { GET } from "./+server";

async function fetchSecurityTxt(origin: string) {
  const headers: Record<string, string> = {};
  const response = await GET({
    url: new URL(`${origin}/.well-known/security.txt`),
    setHeaders: (values: Record<string, string>) =>
      Object.assign(headers, values),
  } as unknown as RequestEvent);
  return { body: await response.text(), headers };
}

function field(body: string, name: string): string[] {
  return body
    .split("\n")
    .filter((line) => line.startsWith(`${name}: `))
    .map((line) => line.slice(name.length + 2));
}

describe("GET /.well-known/security.txt", () => {
  it("lists the private advisory form and an e-mail address as contacts", async () => {
    const { body } = await fetchSecurityTxt("https://loomkeep.app");

    expect(field(body, "Contact")).toEqual([
      "https://github.com/Logan2234/loomkeep/security/advisories/new",
      "mailto:contact@loomkeep.app",
    ]);
  });

  // RFC 9116 makes Expires mandatory and asks for less than a year ahead.
  it("expires in the future, within a year", async () => {
    const { body } = await fetchSecurityTxt("https://loomkeep.app");
    const [expires] = field(body, "Expires");
    const inMs = Date.parse(expires) - Date.now();

    expect(inMs).toBeGreaterThan(0);
    expect(inMs).toBeLessThan(365 * 24 * 60 * 60 * 1000);
  });

  it("names its canonical URL on the origin it was reached at", async () => {
    const { body } = await fetchSecurityTxt("https://tracker.example.org");

    expect(field(body, "Canonical")).toEqual([
      "https://tracker.example.org/.well-known/security.txt",
    ]);
  });

  it("is served as UTF-8 plain text", async () => {
    const { headers } = await fetchSecurityTxt("https://loomkeep.app");

    expect(headers["content-type"]).toBe("text/plain; charset=utf-8");
  });
});
