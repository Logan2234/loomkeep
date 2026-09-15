import { describe, expect, it } from "vitest";
import { readImportFile } from "./import-file";

describe("readImportFile", () => {
  it("decodes Babelio's Windows-1252 CSV without replacing French characters", async () => {
    const file = {
      arrayBuffer: async () =>
        Uint8Array.from([
          0x48, 0x61, 0x72, 0x72, 0x79, 0x20, 0x50, 0x6f, 0x74, 0x74,
          0x65, 0x72, 0x20, 0xe0, 0x20, 0x6c, 0x27, 0xe9, 0x63, 0x6f,
          0x6c, 0x65,
        ]).buffer,
      text: async () => "Harry Potter � l'�cole",
    } as Pick<File, "arrayBuffer" | "text">;

    await expect(readImportFile(file, "windows-1252")).resolves.toBe(
      "Harry Potter à l'école",
    );
  });
});
