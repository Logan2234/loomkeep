import type { Domain } from "../enums";
import { DORMANT_AFTER_DAYS } from "./library";

export const MAX_SESSION_DURATION_MINUTES = 9999;

export interface SessionTimerDto {
  id: string;
  domain: Extract<Domain, "GAMES" | "BOOKS">;
  entryId: string;
  startedAt: string;
  pausedAt: string | null;
  elapsedSeconds: number;
}

export interface StartSessionTimerDto {
  domain: Extract<Domain, "GAMES" | "BOOKS">;
  entryId: string;
  resumeTracking?: boolean;
}

export interface FinishSessionTimerDto {
  notes?: string | null;
  pagesRead?: number;
  startPage?: number;
  endPage?: number;
}

export interface SessionWeekDayDto {
  date: string;
  durationMinutes: number;
  sessionCount: number;
}

/** A currently active work whose latest dated session is older than 30 days. */
export function isSessionPaused(
  entry: { status: string; lastSessionAt: string | Date | null },
  activeStatus: string,
  now: Date = new Date(),
): boolean {
  if (entry.status !== activeStatus || !entry.lastSessionAt) return false;
  const elapsedMs = now.getTime() - new Date(entry.lastSessionAt).getTime();
  return elapsedMs > DORMANT_AFTER_DAYS * 24 * 60 * 60 * 1000;
}
