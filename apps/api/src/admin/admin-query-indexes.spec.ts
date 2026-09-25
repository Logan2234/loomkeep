import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin query indexes", () => {
  it("covers the chronological import, security and reporter queues", () => {
    const schema = readFileSync(
      resolve(__dirname, "../../prisma/schema.prisma"),
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
