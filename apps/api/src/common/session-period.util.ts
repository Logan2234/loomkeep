import type { SessionWeekDayDto } from "@loomkeep/shared";
import { utcDateKey } from "./date.util";
import { localDayOrUtc } from "./local-day.util";

interface DatedDuration {
  durationMinutes: number;
  occurredAt: Date;
}

export function sessionPeriodMinutes(
  sessions: DatedDuration[],
  timezone: string,
  now = new Date(),
): {
  weekMinutes: number;
  weekSessions: number;
  weekDays: SessionWeekDayDto[];
  monthMinutes: number;
} {
  const today = localDayOrUtc(timezone, now);
  const todayUtc = new Date(`${today}T00:00:00.000Z`);
  const weekday = todayUtc.getUTCDay() || 7;
  const weekStart = new Date(todayUtc);
  weekStart.setUTCDate(todayUtc.getUTCDate() - weekday + 1);
  const weekStartDay = utcDateKey(weekStart);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setUTCDate(weekStart.getUTCDate() + index);
    return {
      date: utcDateKey(date),
      durationMinutes: 0,
      sessionCount: 0,
    };
  });
  const weekDayByDate = new Map(weekDays.map((day) => [day.date, day]));
  const month = today.slice(0, 7);
  let weekMinutes = 0;
  let weekSessions = 0;
  let monthMinutes = 0;

  for (const session of sessions) {
    const day = localDayOrUtc(timezone, session.occurredAt);

    if (day >= weekStartDay && day <= today) {
      weekMinutes += session.durationMinutes;
      weekSessions += 1;
      const weekDay = weekDayByDate.get(day);

      if (weekDay) {
        weekDay.durationMinutes += session.durationMinutes;
        weekDay.sessionCount += 1;
      }
    }

    if (day.startsWith(month) && day <= today) {
      monthMinutes += session.durationMinutes;
    }
  }

  return { weekMinutes, weekSessions, weekDays, monthMinutes };
}
