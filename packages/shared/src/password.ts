/**
 * Single source of truth for the password strength rule, consumed both by
 * the web app's live checklist (`PasswordRequirements.svelte`) and the API's
 * `class-validator` DTOs (`@Matches`), so the two can never drift apart.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_UPPERCASE_RE = /[A-Z]/;
export const PASSWORD_DIGIT_RE = /[0-9]/;
export const PASSWORD_SPECIAL_RE = /[^A-Za-z0-9]/;

export function isPasswordValid(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    PASSWORD_UPPERCASE_RE.test(password) &&
    PASSWORD_DIGIT_RE.test(password) &&
    PASSWORD_SPECIAL_RE.test(password)
  );
}
