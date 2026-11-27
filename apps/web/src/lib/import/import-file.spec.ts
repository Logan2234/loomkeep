import { describe, expect, it } from "vitest";
import { readImportFile } from "./import-file";

/** A File-like over raw bytes, as the browser hands an upload over. */
function upload(bytes: number[]): Pick<File, "arrayBuffer" | "text"> {
  const buffer = Uint8Array.from(bytes).buffer;
  return {
    arrayBuffer: async () => buffer,
    text: async () => new TextDecoder().decode(buffer),
  };
}

// "Amélie": é is 0xC3 0xA9 in UTF-8, a single 0xE9 in Windows-1252.
const UTF8 = [0x41, 0x6d, 0xc3, 0xa9, 0x6c, 0x69, 0x65];
const WINDOWS_1252 = [0x41, 0x6d, 0xe9, 0x6c, 0x69, 0x65];

describe("readImportFile", () => {
  it("decodes Babelio's Windows-1252 CSV without replacing French characters", async () => {
    const file = {
      arrayBuffer: async () =>
        Uint8Array.from([
          0x48, 0x61, 0x72, 0x72, 0x79, 0x20, 0x50, 0x6f, 0x74, 0x74, 0x65,
          0x72, 0x20, 0xe0, 0x20, 0x6c, 0x27, 0xe9, 0x63, 0x6f, 0x6c, 0x65,
        ]).buffer,
      text: async () => "Harry Potter � l'�cole",
    } as Pick<File, "arrayBuffer" | "text">;

    await expect(readImportFile(file, "windows-1252")).resolves.toBe(
      "Harry Potter à l'école",
    );
  });

  // IMDb has shipped its CSVs in both encodings, depending on the year.
  it("reads a UTF-8 export as UTF-8 when told to sniff", async () => {
    await expect(readImportFile(upload(UTF8), "auto")).resolves.toBe("Amélie");
  });

  it("falls back to Windows-1252 when the bytes are not valid UTF-8", async () => {
    await expect(readImportFile(upload(WINDOWS_1252), "auto")).resolves.toBe(
      "Amélie",
    );
  });
});
