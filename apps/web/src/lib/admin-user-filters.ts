export const ADMIN_USER_ADVANCED_KEYS = [
  "createdFrom",
  "createdTo",
  "activeFrom",
  "activeTo",
  "mfa",
  "newsletter",
  "push",
  "session",
] as const;

export type AdminUserAdvancedKey = (typeof ADMIN_USER_ADVANCED_KEYS)[number];
export type AdminUserAdvancedFilters = Record<AdminUserAdvancedKey, string>;

export function localDayBoundary(
  value: string,
  exclusiveEnd = false,
): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  if (
    start.getFullYear() !== year ||
    start.getMonth() !== month - 1 ||
    start.getDate() !== day
  )
    return undefined;
  return new Date(year, month - 1, day + Number(exclusiveEnd)).toISOString();
}
