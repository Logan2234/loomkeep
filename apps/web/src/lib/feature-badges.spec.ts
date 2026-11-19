import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isRecentlyShipped } from "./feature-badges";

describe("isRecentlyShipped", () => {
  // East of UTC, where local midnight comes before UTC's.
  const originalTz = process.env.TZ;
  beforeEach(() => {
    process.env.TZ = "Europe/Paris";
  });
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("shows the badge from the first minute of the shipping day, local time", () => {
    // 00:30 in Paris on the 19th, still the 18th in UTC.
    const now = Date.parse("2026-11-18T23:30:00Z");
    expect(isRecentlyShipped("2026-11-19", now)).toBe(true);
  });

  it("does not show it the evening before", () => {
    // 23:30 in Paris on the 18th.
    const now = Date.parse("2026-11-18T22:30:00Z");
    expect(isRecentlyShipped("2026-11-19", now)).toBe(false);
  });
});

describe("feature badge key contract", () => {
  it("accepts a shipped feature and rejects an unknown key", () => {
    const path = fileURLToPath(new URL("./feature-badges.ts", import.meta.url));
    const program = ts.createProgram([path], {
      noResolve: true,
      skipLibCheck: true,
    });
    const source = program.getSourceFile(path)!;
    const checker = program.getTypeChecker();
    const declaration = source.statements.find(
      (node): node is ts.FunctionDeclaration =>
        ts.isFunctionDeclaration(node) && node.name?.text === "isFeatureNew",
    )!;
    const parameter = checker.getTypeAtLocation(declaration.parameters[0]);
    expect(
      checker.isTypeAssignableTo(
        checker.getStringLiteralType("sessions"),
        parameter,
      ),
    ).toBe(true);
    expect(
      checker.isTypeAssignableTo(
        checker.getStringLiteralType("not-a-shipped-feature"),
        parameter,
      ),
    ).toBe(false);
  });
});
