/** Triggers a browser download for in-memory content, without a server round-trip. */
export function downloadBlob(
  content: string,
  mimeType: string,
  filename: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Keeps the UTC date used by existing export filenames. */
export function datedFilename(
  stem: string,
  extension: string,
  date = new Date(),
): string {
  return `${stem}-${date.toISOString().slice(0, 10)}.${extension}`;
}
