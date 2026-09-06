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
