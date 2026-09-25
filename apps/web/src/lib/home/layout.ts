import type {
  HomeLayoutDto,
  HomeWidgetDto,
  HomeWidgetType,
} from "@loomkeep/shared";
import { HOME_GRID_COLUMNS } from "@loomkeep/shared";
import { compact } from "./grid";
import { DEFAULT_QUICK_LINKS } from "./quick-links";
import { HOME_WIDGETS, isWidgetShown, type HomeGate } from "./widgets";

// The default page keeps the old home's shape: a wide main column and a
// narrow sidebar that never interleave.
const MAIN_COLUMNS = 9;
const SIDEBAR_COLUMNS = HOME_GRID_COLUMNS - MAIN_COLUMNS;

// Each main row shares the 9 columns between its widgets by weight, so a row
// missing one (its domain turned off) lets the others fill it.
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
      ["resume", 2],
    ],
  },
  { h: 6, cells: [["activity", 1]] },
];
const SIDEBAR: [HomeWidgetType, number][] = [
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
  const widgets: HomeWidgetDto[] = [];
  let y = 0;

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

  // With nothing in the main column, the sidebar widgets line up across the
  // page rather than hugging its right edge.
  const alone = widgets.length === 0;
  let sideX = 0;
  let sideY = 0;

  for (const [type, h] of SIDEBAR) {
    if (!isWidgetShown(type, gate)) continue;
    const config = configFor(type);
    widgets.push({
      id: type,
      type,
      x: alone ? sideX : MAIN_COLUMNS,
      y: alone ? 0 : sideY,
      w: alone ? 4 : SIDEBAR_COLUMNS,
      h,
      ...(config ? { config } : {}),
    });
    sideX += 4;
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

/** The widgets the home page shows: stored or default, gated, then compacted. */
export function resolveHomeLayout(
  stored: HomeLayoutDto | null | undefined,
  gate: HomeGate,
): HomeWidgetDto[] {
  const widgets = stored?.widgets ?? defaultHomeLayout(gate);
  return compact(
    widgets.filter((w) => isWidgetShown(w.type, gate)).map(clampWidget),
  );
}

/**
 * Stored widgets the page can't show right now (a domain turned off, social
 * disabled). The editor saves them back untouched, so turning the domain on
 * again brings them back where they were.
 */
export function hiddenWidgets(
  stored: HomeLayoutDto | null | undefined,
  gate: HomeGate,
): HomeWidgetDto[] {
  return (stored?.widgets ?? []).filter((w) => !isWidgetShown(w.type, gate));
}
