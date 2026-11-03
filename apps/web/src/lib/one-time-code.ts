import { RECOVERY_CODE_LENGTH } from "@loomkeep/shared";

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

const RECOVERY_HALF = RECOVERY_CODE_LENGTH / 2;

/**
 * Formats a recovery code field as it's typed into: upper case, and the dash
 * of XXXXX-XXXXX added by the field itself. Erasing that dash also takes the
 * character before it, otherwise the next keystroke would put it straight
 * back.
 */
export function formatRecoveryCode(next: string, previous: string): string {
  let chars = next
    .replace(/[^0-9a-z]/gi, "")
    .toUpperCase()
    .slice(0, RECOVERY_CODE_LENGTH);

  if (next.length < previous.length && chars === previous.replace(/-/g, "")) {
    chars = chars.slice(0, -1);
  }

  return chars.length < RECOVERY_HALF
    ? chars
    : `${chars.slice(0, RECOVERY_HALF)}-${chars.slice(RECOVERY_HALF)}`;
}
