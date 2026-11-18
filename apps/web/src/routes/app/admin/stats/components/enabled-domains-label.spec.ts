import { describe, expect, it } from "vitest";
import { enabledDomainsLabel } from "./enabled-domains-label";

describe("enabledDomainsLabel", () => {
  it("names every bucket differently, accounts with no domain included", () => {
    const labels = [0, 1, 2, 3, 4].map(enabledDomainsLabel);

    expect(new Set(labels).size).toBe(labels.length);
  });
});
