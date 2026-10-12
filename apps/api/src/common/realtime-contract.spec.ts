import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

describe("import progress contract", () => {
  it("requires a string jobId so clients can distinguish concurrent jobs", () => {
    const source = ts.createSourceFile(
      "realtime.ts",
      readFileSync(
        join(__dirname, "../../../../packages/shared/src/realtime.ts"),
        "utf8",
      ),
      ts.ScriptTarget.Latest,
      true,
    );
    const contract = source.statements.find(
      (node): node is ts.InterfaceDeclaration =>
        ts.isInterfaceDeclaration(node) &&
        node.name.text === "ImportProgressEvent",
    );
    const field = contract?.members.find(
      (member): member is ts.PropertySignature =>
        ts.isPropertySignature(member) &&
        member.name.getText(source) === "jobId",
    );
    expect(field).toBeDefined();
    expect(field?.questionToken).toBeUndefined();
    expect(field?.type?.kind).toBe(ts.SyntaxKind.StringKeyword);
  });
});
