export type TooltipPlacement = "top" | "bottom";

export interface TooltipPosition {
  top: number;
  left: number;
  placement: TooltipPlacement;
}

interface Bounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TriggerBounds {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const GAP = 8;
const MARGIN = 8;

export function computeTooltipPosition({
  trigger,
  tooltip,
  viewport,
  placement,
}: {
  trigger: TriggerBounds;
  tooltip: { width: number; height: number };
  viewport: Bounds;
  placement: TooltipPlacement;
}): TooltipPosition {
  const viewportRight = viewport.left + viewport.width;
  const viewportBottom = viewport.top + viewport.height;
  const topPosition = trigger.top - GAP - tooltip.height;
  const bottomPosition = trigger.bottom + GAP;

  let resolvedPlacement = placement;

  if (placement === "top" && topPosition < viewport.top + MARGIN) {
    resolvedPlacement = "bottom";
  } else if (
    placement === "bottom" &&
    bottomPosition + tooltip.height > viewportBottom - MARGIN
  ) {
    resolvedPlacement = "top";
  }

  const preferredTop =
    resolvedPlacement === "top" ? topPosition : bottomPosition;
  const top = Math.max(
    viewport.top + MARGIN,
    Math.min(preferredTop, viewportBottom - MARGIN - tooltip.height),
  );
  const centeredLeft =
    trigger.left + (trigger.right - trigger.left - tooltip.width) / 2;
  const left = Math.max(
    viewport.left + MARGIN,
    Math.min(centeredLeft, viewportRight - MARGIN - tooltip.width),
  );

  return { top, left, placement: resolvedPlacement };
}
