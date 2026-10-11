import {
  BOOK_STATUS_META,
  GAME_STATUS_META,
  MEDIA_STATUS_META,
  MUSIC_STATUS_META,
} from "#lib/constants/status-labels.js";
import { STATUS_LOOKS, type StatusTone } from "#lib/constants/status-looks.js";
import { formatHours } from "#lib/format.js";
import { m } from "#lib/paraglide/messages.js";
import type { WorkFriendsDto, WorkProgressDto } from "@loomkeep/shared";

export type WorkDomain = "MEDIA" | "BOOKS" | "GAMES" | "MUSIC";

const LABELS: Record<WorkDomain, Record<string, { label: string }>> = {
  MEDIA: MEDIA_STATUS_META,
  BOOKS: BOOK_STATUS_META,
  GAMES: GAME_STATUS_META,
  MUSIC: MUSIC_STATUS_META,
};

export const toneOf = (domain: WorkDomain, p: WorkProgressDto): StatusTone =>
  STATUS_LOOKS[domain][p.status]?.tone ?? "idle";

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * How far someone got, in the work's own terms — an episode, a page, hours
 * played — or else their status.
 */
export function progressLabel(domain: WorkDomain, p: WorkProgressDto): string {
  if (toneOf(domain, p) === "active") {
    if (p.season && p.episode) return `S${pad2(p.season)}E${pad2(p.episode)}`;
    if (p.page) return m.work_friends_page({ page: p.page });
    if (p.playtimeMinutes) return formatHours(p.playtimeMinutes);
  }

  return LABELS[domain][p.status]?.label ?? p.status;
}

/** How the reel lays the friends out: on the episodes, the pages, or by status. */
export function reelMode(data: WorkFriendsDto): "episodes" | "pages" | "lanes" {
  if (data.seasons.length > 0) return "episodes";
  return [data.me, ...data.friends].some((p) => p?.pageCount)
    ? "pages"
    : "lanes";
}

/** Where someone stands along the work, 0 to 1, when it has a progression. */
export function positionOf(
  domain: WorkDomain,
  data: WorkFriendsDto,
  p: WorkProgressDto | null,
): number | null {
  if (!p) return null;

  if (data.seasons.length > 0) {
    if (!p.season || !p.episode) return null;
    const total = data.seasons.reduce((sum, n) => sum + n, 0);
    const before = data.seasons
      .slice(0, p.season - 1)
      .reduce((sum, n) => sum + n, 0);
    return total ? Math.min(1, (before + p.episode) / total) : null;
  }

  if (!p.pageCount) return null;
  if (toneOf(domain, p) === "done") return 1;
  return p.page ? Math.min(1, p.page / p.pageCount) : null;
}

/** Whether a friend got further than the viewer: who could spoil it. */
export function isAhead(
  domain: WorkDomain,
  data: WorkFriendsDto,
  friend: WorkProgressDto,
): boolean {
  const mine = data.me ? toneOf(domain, data.me) : null;
  if (mine === "done") return false;
  if (toneOf(domain, friend) === "done") return true;

  const theirs = positionOf(domain, data, friend);
  return theirs !== null && theirs > (positionOf(domain, data, data.me) ?? 0);
}

export interface Lane<T> {
  tone: StatusTone;
  title: string;
  people: T[];
}

const LANE_ORDER: StatusTone[] = ["idle", "active", "done"];

/**
 * The friends by status, for a work without a progression: to do, under way,
 * done — dropped ones with the done, said so in the column's title.
 */
export function lanes<T extends WorkProgressDto>(
  domain: WorkDomain,
  people: T[],
): Lane<T>[] {
  const tone = (p: T) => {
    const t = toneOf(domain, p);
    return t === "dropped" ? "done" : t;
  };

  const statusOf = (t: StatusTone) =>
    // The last of a tone is the one that reads best: "Terminé" over "À jour".
    Object.entries(STATUS_LOOKS[domain])
      .filter(([, l]) => l.tone === t)
      .at(-1)?.[0];

  return LANE_ORDER.map((t) => {
    const inLane = people.filter((p) => tone(p) === t);
    const dropped = inLane.some((p) => toneOf(domain, p) === "dropped");
    const titles = [statusOf(t), dropped ? statusOf("dropped") : undefined]
      .filter((s): s is string => !!s)
      .map((s) => LABELS[domain][s].label);
    return { tone: t, title: titles.join(" · "), people: inLane };
  }).filter((lane) => lane.people.length > 0);
}

const DID: Record<WorkDomain, Partial<Record<StatusTone, () => string>>> = {
  MEDIA: {
    done: m.work_friends_did_media_done,
    active: m.work_friends_did_media_active,
    idle: m.work_friends_did_media_idle,
    dropped: m.work_friends_did_media_dropped,
  },
  BOOKS: {
    done: m.work_friends_did_books_done,
    active: m.work_friends_did_books_active,
    idle: m.work_friends_did_books_idle,
    dropped: m.work_friends_did_books_dropped,
  },
  GAMES: {
    done: m.work_friends_did_games_done,
    active: m.work_friends_did_games_active,
    idle: m.work_friends_did_games_idle,
    dropped: m.work_friends_did_games_dropped,
  },
  MUSIC: {
    done: m.work_friends_did_music_done,
    idle: m.work_friends_did_music_idle,
  },
};

/** What someone did with the work, said after their name: "l'a terminé". */
export function didLabel(domain: WorkDomain, p: WorkProgressDto): string {
  return DID[domain][toneOf(domain, p)]?.() ?? progressLabel(domain, p);
}

/** "Léa", "Léa et Max", "Léa, Max et 3 autres": the folded line's names. */
export function namesLabel(names: string[]): string {
  const [first, second] = names;
  if (names.length === 1) return first;
  if (names.length === 2) return m.work_friends_names_two({ first, second });
  return names.length === 3
    ? m.work_friends_names_more_one({ first, second })
    : m.work_friends_names_more_many({
        first,
        second,
        count: names.length - 2,
      });
}

export interface ToneCount {
  tone: StatusTone;
  label: string;
  icon: (typeof STATUS_LOOKS)[WorkDomain][string]["icon"];
  count: number;
}

/** How many friends per status, done first: the folded line's counters. */
export function toneCounts(
  domain: WorkDomain,
  people: WorkProgressDto[],
): ToneCount[] {
  return (["done", "active", "idle", "dropped"] as const).flatMap((tone) => {
    const status = Object.entries(STATUS_LOOKS[domain])
      .filter(([, l]) => l.tone === tone)
      .at(-1);
    const count = people.filter((p) => toneOf(domain, p) === tone).length;
    return status && count > 0
      ? [
          {
            tone,
            label: LABELS[domain][status[0]].label,
            icon: status[1].icon,
            count,
          },
        ]
      : [];
  });
}
