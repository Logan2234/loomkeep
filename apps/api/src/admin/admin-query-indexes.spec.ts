import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("admin query indexes", () => {
  it("covers the chronological import, security and reporter queues", () => {
    const dir = resolve(__dirname, "../../prisma/schema");
    const schema = readdirSync(dir)
      .filter((file) => file.endsWith(".prisma"))
      .map((file) => readFileSync(resolve(dir, file), "utf8"))
      .join("\n");
    const model = (name: string) =>
      schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ??
      "";

    expect(model("ImportRun")).toContain("@@index([startedAt])");
    expect(model("SecurityEvent")).toContain("@@index([createdAt])");
    expect(model("Report")).toContain(
      "@@index([reporterId, status, createdAt])",
    );
  });
});
