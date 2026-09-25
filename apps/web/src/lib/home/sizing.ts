// How a widget's content reflows with the room it's given. Widgets get their
// pixel size from the grid (not a CSS container query) so the editor can
// reflow them live while a resize is still in progress.

export interface BoxSize {
  width: number;
  height: number;
}

// WidgetShell's padding, header and border, around the body a widget lays
// out in: p-4 on each side, a 24px header and its 12px margin, a 1px border.
const SHELL_X = 16 * 2 + 2;
const SHELL_Y = 16 * 2 + 24 + 12 + 2;

export const bodyOf = (size: BoxSize): BoxSize => ({
  width: Math.max(0, size.width - SHELL_X),
  height: Math.max(0, size.height - SHELL_Y),
});

/** One row of a list-mode widget: a 32px-wide cover and two lines of text. */
const LIST_ROW_HEIGHT = 56;

// Everything a poster card stacks under the poster has a fixed height —
// PosterRail reserves it even on a card that has nothing to show there, so
// the posters and buttons of a strip line up and the posters fill the rest.
const POSTER_TITLE_HEIGHT = 22;
export const POSTER_ACTION_HEIGHT = 32;
const POSTER_BORDER = 2;
// The strip's bottom padding, and on a touch screen its page dots.
const TRACK_PADDING = 4;
const DOTS = 16;

const MIN_POSTER_HEIGHT = 90;
const STRIP_MIN_HEIGHT = 130;

export type PosterLayout =
  | {
      mode: "strip";
      posterHeight: number;
      posterWidth: number;
      showMeta: boolean;
      showAction: boolean;
    }
  | { mode: "list"; rows: number; showAction: boolean };

/**
 * Posters side by side when there's room for them, a list of rows when the
 * widget is narrow or very short. In a strip the posters take every pixel
 * of height left, and what sits under them (`meta`: a progress bar or a
 * timecode, `action`: a button) drops out first as the widget shrinks.
 */
export function posterLayout(
  body: BoxSize,
  {
    meta = 0,
    action = false,
    stripMinWidth = 300,
    touch = false,
  }: {
    meta?: number;
    action?: boolean;
    stripMinWidth?: number;
    touch?: boolean;
  } = {},
): PosterLayout {
  if (body.width < stripMinWidth || body.height < STRIP_MIN_HEIGHT) {
    return {
      mode: "list",
      rows: Math.max(1, Math.floor(body.height / LIST_ROW_HEIGHT)),
      showAction: action && body.width >= 220,
    };
  }

  const room =
    body.height -
    POSTER_TITLE_HEIGHT -
    POSTER_BORDER -
    TRACK_PADDING -
    (touch ? DOTS : 0);
  const showMeta = meta > 0 && room - meta >= MIN_POSTER_HEIGHT + 30;
  const showAction =
    action && room - meta - POSTER_ACTION_HEIGHT >= MIN_POSTER_HEIGHT + 60;
  const posterHeight = Math.max(
    MIN_POSTER_HEIGHT,
    room - (showMeta ? meta : 0) - (showAction ? POSTER_ACTION_HEIGHT : 0),
  );
  return {
    mode: "strip",
    posterHeight,
    posterWidth: Math.round((posterHeight * 2) / 3) + POSTER_BORDER,
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
