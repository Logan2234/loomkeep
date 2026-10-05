import { m } from "$lib/paraglide/messages.js";
import type { IconName } from "$lib/types/icon-name";
import {
  levelForXp,
  type XpHistoryDayDto,
  type XpHistoryItemDto,
  type XpReason,
} from "@loomkeep/shared";

// Reason and achievement labels are keyed by construction, like
// achievement-labels.ts: the keys arrive from the API as plain strings.
const messages = m as unknown as Record<string, (() => string) | undefined>;

/** Consecutive lines of one reason, gained or taken back. */
export interface XpRun {
  kind: "run";
  key: string;
  reason: XpReason;
  revoked: boolean;
  total: number;
  /** Most recent first. */
  items: XpHistoryItemDto[];
}

/** Where the total crossed into another level, between two lines. */
interface XpLevelMark {
  kind: "level";
  key: string;
  level: number;
  up: boolean;
}

export interface XpTimelineDay {
  day: string;
  net: number;
  /** Most recent first. */
  segments: (XpRun | XpLevelMark)[];
  levelUp: boolean;
}

export interface XpChartBar {
  day: string;
  net: number;
  levelUp: boolean;
}

/**
 * Turns the loaded days into runs of the same reason, cut where the total
 * crossed into another level. The total before each line is the one after it
 * minus its amount, walking back from the current total: the loaded pages run
 * back from today without gaps, so the lines chain across days.
 */
export function buildTimeline(
  days: XpHistoryDayDto[],
  currentXp: number,
): XpTimelineDay[] {
  let after = currentXp;

  return days.map((day) => {
    const segments: (XpRun | XpLevelMark)[] = [];
    let run: XpRun | null = null;
    let levelUp = false;

    day.items.forEach((item, index) => {
      const before = Math.max(0, after - item.amount);
      const levelAfter = levelForXp(after);
      const levelBefore = levelForXp(before);

      // Newest first: the mark sits above the line that crossed the level.
      if (levelAfter !== levelBefore) {
        const up = levelAfter > levelBefore;
        segments.push({
          kind: "level",
          key: `${day.day}:level:${index}`,
          level: levelAfter,
          up,
        });
        if (up) levelUp = true;
        run = null;
      }

      if (!run || run.reason !== item.reason || run.revoked !== item.revoked) {
        run = {
          kind: "run",
          key: `${day.day}:run:${index}`,
          reason: item.reason,
          revoked: item.revoked,
          total: 0,
          items: [],
        };
        segments.push(run);
      }

      run.items.push(item);
      run.total += item.amount;
      after = before;
    });

    return { day: day.day, net: day.net, segments, levelUp };
  });
}

/** The last `count` calendar days up to `today`, oldest first, quiet days at zero. */
export function chartBars(
  days: XpTimelineDay[],
  today: string,
  count = 14,
): XpChartBar[] {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const end = Date.parse(`${today}T00:00:00Z`);

  return Array.from({ length: count }, (_, i) => {
    const day = new Date(end - (count - 1 - i) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const view = byDay.get(day);
    return { day, net: view?.net ?? 0, levelUp: view?.levelUp ?? false };
  });
}

/** "YYYY-MM-DD" of `date` in the browser's own timezone. */
export function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function reasonLabel(reason: XpReason): string {
  return (
    messages[`gamification_xp_reason_${reason.toLowerCase()}`]?.() ?? reason
  );
}

export function runLabel(group: XpRun): string {
  const label = reasonLabel(group.reason);
  return group.revoked
    ? m.gamification_xp_history_revoked({ reason: label.toLowerCase() })
    : label;
}

const REASON_ICON: Record<XpReason, IconName> = {
  EPISODE_WATCHED: "tv",
  MOVIE_WATCHED: "play",
  MOVIE_REPLAYED: "refresh",
  SEASON_COMPLETED: "tv",
  SERIES_COMPLETED: "check",
  GAME_FINISHED: "gamepad",
  GAME_REPLAYED: "refresh",
  BOOK_FINISHED: "book",
  BOOK_REPLAYED: "refresh",
  SESSION_DAY_LOGGED: "calendar",
  ALBUM_LISTENED: "music",
  WORK_ADDED: "plus",
  DOMAIN_STARTED: "compass",
  WORK_RATED: "star",
  REVIEW_WRITTEN: "edit",
  REVIEW_DETAILED: "edit",
  COMMENT_POSTED: "message",
  REVIEW_VOTE_RECEIVED: "flame",
  COMMENT_REACTION_RECEIVED: "sparkles",
  LIST_CREATED: "list",
  IMPORT_COMPLETED: "download",
  PROFILE_COMPLETED: "user",
  ACHIEVEMENT_UNLOCKED: "trophy",
  ADMIN_ADJUSTMENT: "shield",
  SAGA_COMPLETED: "library",
  READING_GOAL_REACHED: "gauge",
};

export const reasonIcon = (reason: XpReason): IconName =>
  REASON_ICON[reason] ?? "sparkles";

const DOMAIN_MESSAGE: Record<string, string> = {
  MEDIA: "common_Media",
  GAMES: "common_Games",
  BOOKS: "common_Books",
  MUSIC: "common_Music",
};

const pad2 = (n: number) => String(n).padStart(2, "0");

/** What one line is about: "The Bear · S03E02", an achievement, a domain. */
export function itemLabel(item: XpHistoryItemDto): string {
  if (item.achievementKey) {
    return (
      messages[`gamification_${item.achievementKey}_name`]?.() ??
      item.achievementKey
    );
  }

  if (item.goalTarget !== null && item.goalYear !== null) {
    return m.gamification_xp_history_goal({
      year: item.goalYear,
      count: item.goalTarget,
    });
  }

  if (item.domain) {
    return messages[DOMAIN_MESSAGE[item.domain] ?? ""]?.() ?? item.domain;
  }

  if (!item.title) return "";
  if (item.seasonNumber === null) return item.title;
  const code =
    item.episodeNumber === null
      ? `S${pad2(item.seasonNumber)}`
      : `S${pad2(item.seasonNumber)}E${pad2(item.episodeNumber)}`;
  return `${item.title} · ${code}`;
}

/** The run's line under its label: one subject in full, several by title. */
export function runDescription(group: XpRun): string {
  if (group.items.length === 1) return itemLabel(group.items[0]);

  const names = [
    ...new Set(
      group.items.map((item) =>
        item.title && !item.achievementKey && !item.domain
          ? item.title
          : itemLabel(item),
      ),
    ),
  ].filter(Boolean);
  if (names.length <= 2) return names.join(", ");

  const others = names.length - 2;
  const titles = names.slice(0, 2).join(", ");
  return others === 1
    ? m.gamification_xp_history_others_one({ titles })
    : m.gamification_xp_history_others_many({ titles, count: others });
}
