import { localDay } from "./local-day.util";

interface DatedDuration {
  durationMinutes: number;
  occurredAt: Date;
}

export function sessionPeriodMinutes(
  sessions: DatedDuration[],
  timezone: string,
  now = new Date(),
): { weekMinutes: number; monthMinutes: number } {
  const today = localDay(timezone, now) ?? now.toISOString().slice(0, 10);
  const todayUtc = new Date(`${today}T00:00:00.000Z`);
  const weekday = todayUtc.getUTCDay() || 7;
  const weekStart = new Date(todayUtc);
  weekStart.setUTCDate(todayUtc.getUTCDate() - weekday + 1);
  const weekStartDay = weekStart.toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  let weekMinutes = 0;
  let monthMinutes = 0;

  for (const session of sessions) {
    const day =
      localDay(timezone, session.occurredAt) ??
      session.occurredAt.toISOString().slice(0, 10);

    if (day >= weekStartDay && day <= today) {
      weekMinutes += session.durationMinutes;
    }

    if (day.startsWith(month) && day <= today) {
      monthMinutes += session.durationMinutes;
    }
  }

  return { weekMinutes, monthMinutes };
}
