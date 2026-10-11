import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

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
