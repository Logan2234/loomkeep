/**
 * Cleans a one-time code field as it's typed or pasted into, and returns the
 * cleaned value. Codes often come with spaces around or inside them ("123 456"
 * in an email); a `maxlength` would count those and cut digits off before
 * they could be trimmed, so the spaces go first and the length cap after.
 */
export function normalizeCodeInput(
  input: HTMLInputElement,
  length: number,
): string {
  input.value = input.value.replace(/\s/g, "").slice(0, length);
  return input.value;
}
