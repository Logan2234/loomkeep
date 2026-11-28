export { localDateInput } from "../ui/date";

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

/** A run of sessions of the same cycle (a reading, a playthrough). */
export interface SessionGroup<S> {
  key: string;
  label: string;
  sessions: S[];
  totalMinutes: number;
}

/**
 * The page's sessions grouped by cycle, in the order each cycle first
 * appears; the sessions kept as history only form their own group.
 */
export function groupSessionsByCycle<S extends { durationMinutes: number }>(
  sessions: S[],
  cycleOf: (session: S) => number | null,
  labelOf: (cycle: number | null) => string,
): SessionGroup<S>[] {
  const groups = new Map<string, SessionGroup<S>>();

  for (const session of sessions) {
    const cycle = cycleOf(session);
    const key = String(cycle ?? "standalone");
    const group = groups.get(key);

    if (group) {
      group.sessions.push(session);
      group.totalMinutes += session.durationMinutes;
    } else {
      groups.set(key, {
        key,
        label: labelOf(cycle),
        sessions: [session],
        totalMinutes: session.durationMinutes,
      });
    }
  }

  return [...groups.values()];
}
