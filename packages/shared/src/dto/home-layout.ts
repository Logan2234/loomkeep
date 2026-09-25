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
  "latestReviews",
  "statsBrief",
  "tonightPick",
  "onThisDay",
  "quickSearch",
] as const;
export type HomeWidgetType = (typeof HOME_WIDGET_TYPES)[number];

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
  /** note: its text, as typed. */
  text?: string;
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
