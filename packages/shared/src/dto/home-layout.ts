import type { Domain, MediaType } from "../enums";
import type { LeaderboardPeriod, LeaderboardScope } from "./gamification";

/** Columns of the home grid on a wide screen; a phone stacks the widgets instead. */
export const HOME_GRID_COLUMNS = 12;

/** Upper bounds the API enforces on a saved layout. */
export const HOME_LAYOUT_LIMITS = {
  widgets: 40,
  quickLinks: 20,
  maxRow: 400,
  maxHeight: 24,
  labelLength: 60,
  urlLength: 2048,
  noteLength: 1000,
} as const;

/**
 * Widget kinds. The web owns what each one renders and its size bounds; the
 * API only checks a saved layout names known kinds.
 */
export const HOME_WIDGET_TYPES = [
  "toWatch",
  "thisWeek",
  "gamesPlaying",
  "booksReading",
  "musicToListen",
  "readingGoal",
  "activity",
  "quickLinks",
  "resume",
  "savedView",
  "listContent",
  "myLists",
  "dividerHorizontal",
  "dividerVertical",
  "note",
  "friendsPodium",
  "levelStreak",
  "favorites",
  "tonightPick",
  "onThisDay",
  "quickSearch",
] as const;
export type HomeWidgetType = (typeof HOME_WIDGET_TYPES)[number];

/**
 * Orders a widget can sort its works in. Each kind offers the ones that mean
 * something for it, and the web maps them onto that kind's own sort.
 */
export const HOME_WIDGET_SORTS = [
  "recent",
  "title",
  "progress",
  "created",
  "size",
] as const;
export type HomeWidgetSort = (typeof HOME_WIDGET_SORTS)[number];

/**
 * An app screen (`kind: "app"`, with `id` a web navigation id) or any http(s)
 * address (`kind: "url"`, with `url` and `label`). Flat rather than a union:
 * the API describes it as one OpenAPI object.
 */
export interface HomeQuickLinkDto {
  kind: "app" | "url";
  id?: string;
  url?: string;
  label?: string;
}

/** Per-kind settings; a kind reads only the fields it defines. */
export interface HomeWidgetConfigDto {
  /** quickLinks: the links, in display order. */
  links?: HomeQuickLinkDto[];
  /** listContent: the list to show. */
  listId?: string;
  /** savedView: the saved library view to show. */
  viewId?: string;
  /** note: its text, as typed. */
  text?: string;
  /** activity, favorites: the domains to show — all enabled ones when unset. */
  domains?: Domain[];
  /** toWatch, tonightPick: the media types to include — all when unset. */
  mediaTypes?: MediaType[];
  /** friendsPodium: who is ranked — the user's friends when unset. */
  scope?: LeaderboardScope;
  /** friendsPodium: the XP counted — this month's when unset. */
  period?: LeaderboardPeriod;
  /** myLists, gamesPlaying, booksReading, musicToListen: "recent" when unset. */
  sort?: HomeWidgetSort;
  /** myLists: only the user's own lists, not those they edit with others. */
  ownOnly?: boolean;
}

/** A widget on the grid, in grid cells: column `x`, row `y`, `w` × `h`. */
export interface HomeWidgetDto {
  /** Stable within a layout, so several widgets of one kind stay distinct. */
  id: string;
  type: HomeWidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: HomeWidgetConfigDto;
}

export interface HomeLayoutDto {
  widgets: HomeWidgetDto[];
}
