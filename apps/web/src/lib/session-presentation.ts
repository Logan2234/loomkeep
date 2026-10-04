export const MAX_SESSION_DURATION_MINUTES = 9999;

export { localDateInput } from "./date";

export function sessionDateToIso(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12).toISOString();
}

export function formatSessionMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} h` : `${hours} h ${remainder} min`;
}
