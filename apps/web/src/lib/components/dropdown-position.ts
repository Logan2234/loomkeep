type DropdownPlacement = "bottom-start" | "bottom-end";

type Rect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type Size = { width: number; height: number };

type Viewport = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type PositionInput = {
  trigger: Rect;
  panel: Size;
  viewport: Viewport;
  placement: DropdownPlacement;
  bottomInset: number;
};

export type DropdownPosition = {
  top: number;
  left: number;
  maxWidth: number;
  maxHeight: number;
  originY: "top" | "bottom";
};

const VIEWPORT_MARGIN = 8;
const TRIGGER_GAP = 4;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export function computeDropdownPosition({
  trigger,
  panel,
  viewport,
  placement,
  bottomInset,
}: PositionInput): DropdownPosition {
  const viewportTop = viewport.top + VIEWPORT_MARGIN;
  const viewportLeft = viewport.left + VIEWPORT_MARGIN;
  const viewportRight = viewport.left + viewport.width - VIEWPORT_MARGIN;
  const viewportBottom =
    viewport.top + viewport.height - Math.max(VIEWPORT_MARGIN, bottomInset);
  const maxWidth = Math.max(0, viewportRight - viewportLeft);
  const panelWidth = Math.min(panel.width, maxWidth);
  const availableBelow = Math.max(
    0,
    viewportBottom - trigger.bottom - TRIGGER_GAP,
  );
  const availableAbove = Math.max(0, trigger.top - viewportTop - TRIGGER_GAP);
  const placeAbove =
    panel.height > availableBelow && availableAbove > availableBelow;
  const maxHeight = Math.min(
    panel.height,
    placeAbove ? availableAbove : availableBelow,
  );
  const anchoredLeft =
    placement === "bottom-end" ? trigger.right - panelWidth : trigger.left;

  return {
    top: placeAbove
      ? Math.max(viewportTop, trigger.top - TRIGGER_GAP - maxHeight)
      : trigger.bottom + TRIGGER_GAP,
    left: clamp(anchoredLeft, viewportLeft, viewportRight - panelWidth),
    maxWidth,
    maxHeight,
    originY: placeAbove ? "bottom" : "top",
  };
}
