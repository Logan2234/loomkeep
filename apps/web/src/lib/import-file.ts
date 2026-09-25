export async function readImportFile(
  file: Pick<File, "arrayBuffer" | "text">,
  encoding?: string,
): Promise<string> {
  if (!encoding) return file.text();

  return new TextDecoder(encoding).decode(await file.arrayBuffer());
}
