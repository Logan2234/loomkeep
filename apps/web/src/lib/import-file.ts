/**
 * Reads an uploaded export as text.
 *
 * `encoding: "auto"` decodes as UTF-8 and falls back to Windows-1252: IMDb's
 * exports are reported as both depending on the year, so the file itself has to
 * decide rather than the descriptor guessing. Strict mode is what makes the
 * fallback detectable — a Windows-1252 accent is invalid UTF-8.
 */
export async function readImportFile(
  file: Pick<File, "arrayBuffer" | "text">,
  encoding?: string,
): Promise<string> {
  if (!encoding) return file.text();

  const bytes = await file.arrayBuffer();

  if (encoding === "auto") {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder("windows-1252").decode(bytes);
    }
  }

  return new TextDecoder(encoding).decode(bytes);
}
