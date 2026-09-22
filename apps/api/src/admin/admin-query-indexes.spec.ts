import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin query indexes", () => {
  it("covers the chronological import, security and reporter queues", () => {
    const schema = readFileSync(
      new URL("../../prisma/schema.prisma", import.meta.url),
      "utf8",
    );
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
