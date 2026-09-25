import type {
  HomeLayoutDto,
  HomeWidgetDto,
  HomeWidgetType,
} from "@loomkeep/shared";
import { HOME_GRID_COLUMNS } from "@loomkeep/shared";
import { compact } from "./grid";
import { DEFAULT_QUICK_LINKS } from "./quick-links";
import {
  HOME_WIDGETS,
  isDivider,
  isWidgetShown,
  type HomeGate,
} from "./widgets";

// The default page: the search across the top, then a wide main column and a
// narrow sidebar that never interleave.
const MAIN_COLUMNS = 9;
const SIDEBAR_COLUMNS = HOME_GRID_COLUMNS - MAIN_COLUMNS;
const SEARCH_HEIGHT = 1;

// Each main row shares the 9 columns between its widgets by weight, so a row
// missing one (its domain turned off) lets the others fill it. "Il y a un an"
// needs no domain: the third row is never empty, and "Ce soir ?" (6 columns
// at most) never has to stretch over 9 alone.
const MAIN_ROWS: { h: number; cells: [HomeWidgetType, number][] }[] = [
  { h: 6, cells: [["toWatch", 1]] },
  {
    h: 5,
    cells: [
      ["gamesPlaying", 2],
      ["booksReading", 1],
    ],
  },
  {
    h: 5,
    cells: [
      ["musicToListen", 1],
      ["tonightPick", 1],
      ["onThisDay", 1],
    ],
  },
  { h: 6, cells: [["activity", 1]] },
];
const SIDEBAR: [HomeWidgetType, number][] = [
  ["levelStreak", 3],
  ["thisWeek", 5],
  ["readingGoal", 3],
  ["quickLinks", 6],
];

const configFor = (type: HomeWidgetType): HomeWidgetDto["config"] =>
  type === "quickLinks" ? { links: DEFAULT_QUICK_LINKS } : undefined;

/**
 * The page a user gets until they edit it. Built, not stored: it follows the
 * domains they turn on and off, and whatever the default becomes later.
 */
export function defaultHomeLayout(gate: HomeGate): HomeWidgetDto[] {
  const widgets: HomeWidgetDto[] = [
    {
      id: "quickSearch",
      type: "quickSearch",
      x: 0,
      y: 0,
      w: HOME_GRID_COLUMNS,
      h: SEARCH_HEIGHT,
    },
  ];
  let y = SEARCH_HEIGHT;

  for (const row of MAIN_ROWS) {
    const cells = row.cells.filter(([type]) => isWidgetShown(type, gate));
    const total = cells.reduce((sum, [, weight]) => sum + weight, 0);
    let x = 0;
    cells.forEach(([type, weight], i) => {
      const w =
        i === cells.length - 1
          ? MAIN_COLUMNS - x
          : Math.round((MAIN_COLUMNS * weight) / total);
      widgets.push({ id: type, type, x, y, w, h: row.h });
      x += w;
    });
    if (cells.length > 0) y += row.h;
  }

  let sideY = SEARCH_HEIGHT;

  for (const [type, h] of SIDEBAR) {
    if (!isWidgetShown(type, gate)) continue;
    const config = configFor(type);
    widgets.push({
      id: type,
      type,
      x: MAIN_COLUMNS,
      y: sideY,
      w: SIDEBAR_COLUMNS,
      h,
      ...(config ? { config } : {}),
    });
    sideY += h;
  }

  return widgets;
}

/** Pulls a widget back inside its kind's size bounds and the grid. */
function clampWidget(widget: HomeWidgetDto): HomeWidgetDto {
  const { min, max } = HOME_WIDGETS[widget.type];
  const w = Math.min(Math.max(widget.w, min.w), max.w);
  const h = Math.min(Math.max(widget.h, min.h), max.h);
  return {
    ...widget,
    w,
    h,
    x: Math.min(Math.max(widget.x, 0), HOME_GRID_COLUMNS - w),
  };
}

const shownOn = (widgets: HomeWidgetDto[], gate: HomeGate) =>
  compact(widgets.filter((w) => isWidgetShown(w.type, gate)).map(clampWidget));

/**
 * The widgets the home page shows: stored or default, gated, then compacted.
 * A stored page left with nothing to show (every widget's domain turned off,
 * only dividers) falls back to the default one — the home page is never
 * empty.
 */
export function resolveHomeLayout(
  stored: HomeLayoutDto | null | undefined,
  gate: HomeGate,
): HomeWidgetDto[] {
  const widgets = shownOn(stored?.widgets ?? [], gate);
  return widgets.some((w) => !isDivider(w.type))
    ? widgets
    : shownOn(defaultHomeLayout(gate), gate);
}

/**
 * Stored widgets the page can't show right now (a domain turned off, social
 * disabled). The editor saves them back untouched, so turning the domain on
 * again brings them back where they were. A kind that no longer exists is
 * left out: the API would refuse the whole layout over it.
 */
export function hiddenWidgets(
  stored: HomeLayoutDto | null | undefined,
  gate: HomeGate,
): HomeWidgetDto[] {
  return (stored?.widgets ?? []).filter(
    (w) => w.type in HOME_WIDGETS && !isWidgetShown(w.type, gate),
  );
}
