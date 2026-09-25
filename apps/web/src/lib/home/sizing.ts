// How a widget's content reflows with the room it's given. Widgets get their
// pixel size from the grid (not a CSS container query) so the editor can
// reflow them live while a resize is still in progress.

export interface BoxSize {
  width: number;
  height: number;
}

// WidgetShell's padding and header, around the body a widget lays out in.
const SHELL_X = 32;
const SHELL_Y = 68;

export const bodyOf = (size: BoxSize): BoxSize => ({
  width: Math.max(0, size.width - SHELL_X),
  height: Math.max(0, size.height - SHELL_Y),
});

/** One row of a list-mode widget: a 32px-wide cover and two lines of text. */
const LIST_ROW_HEIGHT = 56;

const TITLE_LINE = 22;
// The carousel's page dots on a touch screen, kept free everywhere so the
// posters don't jump between a phone and a desktop.
const DOTS = 16;
const MIN_POSTER_HEIGHT = 90;
const MAX_POSTER_HEIGHT = 260;
const STRIP_MIN_WIDTH = 300;
const STRIP_MIN_HEIGHT = 120;

export type PosterLayout =
  | {
      mode: "strip";
      posterWidth: number;
      showMeta: boolean;
      showAction: boolean;
    }
  | { mode: "list"; rows: number; showAction: boolean };

/**
 * Posters side by side when there's room for them, a list of rows when the
 * widget is narrow or very short. In a strip, the posters grow with the
 * height, and what sits under them (`meta`: a progress bar or a timecode,
 * `action`: a button) drops out first as the widget shrinks.
 */
export function posterLayout(
  body: BoxSize,
  { meta = 0, action = 0 }: { meta?: number; action?: number } = {},
): PosterLayout {
  if (body.width < STRIP_MIN_WIDTH || body.height < STRIP_MIN_HEIGHT) {
    return {
      mode: "list",
      rows: Math.max(1, Math.floor(body.height / LIST_ROW_HEIGHT)),
      showAction: action > 0 && body.width >= 220,
    };
  }

  const room = body.height - TITLE_LINE - DOTS;
  const showMeta = meta > 0 && room - meta >= MIN_POSTER_HEIGHT + 40;
  const showAction =
    action > 0 && showMeta && room - meta - action >= MIN_POSTER_HEIGHT + 60;
  const posterHeight = Math.min(
    MAX_POSTER_HEIGHT,
    Math.max(
      MIN_POSTER_HEIGHT,
      room - (showMeta ? meta : 0) - (showAction ? action : 0),
    ),
  );
  return {
    mode: "strip",
    posterWidth: Math.round((posterHeight * 2) / 3),
    showMeta,
    showAction,
  };
}

/** How many list rows fit, over `columns` side by side when it's wide. */
export function rowsLayout(
  body: BoxSize,
  { rowHeight = LIST_ROW_HEIGHT, twoColumnsFrom = 520 } = {},
): { columns: number; count: number } {
  const columns = body.width >= twoColumnsFrom ? 2 : 1;
  const rows = Math.max(1, Math.floor(body.height / rowHeight));
  return { columns, count: rows * columns };
}
