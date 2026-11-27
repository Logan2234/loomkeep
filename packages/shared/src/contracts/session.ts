import type { SessionCycleAction } from "../enums";
import { DORMANT_AFTER_DAYS } from "./library";

export const SESSION_NOTES_MAX_LENGTH = 1000;

export const MAX_SESSION_DURATION_MINUTES = 9999;

export interface SessionTimerDto {
  id: string;
  domain: SessionDomain;
  entryId: string;
  startedAt: string;
  pausedAt: string | null;
  elapsedSeconds: number;
}

export interface StartSessionTimerDto {
  domain: SessionDomain;
  entryId: string;
  cycleAction?: SessionCycleAction;
}

export interface FinishSessionTimerDto {
  notes?: string | null;
  cycleAction?: SessionCycleAction;
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

export const SESSION_DOMAINS = ["GAMES", "BOOKS"] as const;
export type SessionDomain = (typeof SESSION_DOMAINS)[number];
export const SESSION_FILTER_PAUSED = "PAUSED";

export function timerMinutes(elapsedSeconds: number): number {
  return Math.min(
    MAX_SESSION_DURATION_MINUTES,
    Math.max(1, Math.ceil(elapsedSeconds / 60)),
  );
}
