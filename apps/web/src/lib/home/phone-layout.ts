import type {
  HomePhoneLayoutDto,
  HomePhoneWidgetDto,
  HomeWidgetType,
} from "@loomkeep/shared";
import type { BoxSize } from "./sizing";
import {
  HOME_WIDGETS,
  isWidgetShown,
  rowsToPixels,
  type HomeGate,
} from "./widgets";

// The phone home is its own page, apart from the desktop grid: one column, in
// reading order. It starts with a poster shelf per domain, then the week's
// releases; everything else is added from its editor.
const PHONE_DEFAULT: HomeWidgetType[] = [
  "toWatch",
  "gamesPlaying",
  "booksReading",
  "musicToListen",
  "thisWeek",
];

/** Kinds a phone can show: a single column has nothing to divide vertically. */
export const PHONE_WIDGET_TYPES: readonly HomeWidgetType[] = (
  Object.keys(HOME_WIDGETS) as HomeWidgetType[]
).filter((type) => type !== "dividerVertical");

/** Works widgets a phone draws as posters or rows, at the user's choice. */
export const PHONE_DISPLAY_TYPES: readonly HomeWidgetType[] = [
  "toWatch",
  "gamesPlaying",
  "booksReading",
  "musicToListen",
  "savedView",
  "listContent",
  "favorites",
];

export function defaultPhoneLayout(gate: HomeGate): HomePhoneWidgetDto[] {
  return PHONE_DEFAULT.filter((type) => isWidgetShown(type, gate)).map(
    (type) => ({ id: type, type }),
  );
}

/**
 * The widgets the phone home shows: stored or default, gated. A stored page
 * left with nothing to show falls back to the default — never an empty home.
 */
export function resolvePhoneLayout(
  stored: HomePhoneLayoutDto | null | undefined,
  gate: HomeGate,
): HomePhoneWidgetDto[] {
  const shown = (stored?.widgets ?? []).filter(
    (widget) =>
      PHONE_WIDGET_TYPES.includes(widget.type) &&
      isWidgetShown(widget.type, gate),
  );
  return shown.some((widget) => widget.type !== "dividerHorizontal")
    ? shown
    : defaultPhoneLayout(gate);
}

// A shelf of posters with their title, meta and button; three rows otherwise.
const POSTERS_HEIGHT = 340;
const ROWS_HEIGHT = 238;

/** The room a widget gets on the phone home, which it lays itself out in. */
export function phoneWidgetSize(
  widget: HomePhoneWidgetDto,
  width: number,
): BoxSize {
  if (PHONE_DISPLAY_TYPES.includes(widget.type)) {
    return {
      width,
      height: widget.config?.display === "rows" ? ROWS_HEIGHT : POSTERS_HEIGHT,
    };
  }

  return { width, height: rowsToPixels(HOME_WIDGETS[widget.type].initial.h) };
}

// A poster shelf sits on the page without its block's 18px top and bottom
// padding (app.css, .panel-body:has(.panel-bleed)); the sizing still counts
// them, so its box gives them back.
const SHELF_DROPPED_PADDING = 36;

/** The height of a widget's box in the phone column. */
export function phoneBoxHeight(
  widget: HomePhoneWidgetDto,
  width: number,
): number {
  const { height } = phoneWidgetSize(widget, width);
  const shelf =
    PHONE_DISPLAY_TYPES.includes(widget.type) &&
    widget.config?.display !== "rows";
  return shelf ? height - SHELF_DROPPED_PADDING : height;
}
