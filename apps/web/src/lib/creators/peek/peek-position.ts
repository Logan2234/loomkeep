const MARGIN = 8;
const GAP = 6;

type Rect = { top: number; bottom: number; left: number };
type Size = { width: number; height: number };

/**
 * Under the name, or above it when that's where it fits better. Never over
 * it: the peek is whole, not scrolled, so unlike a menu it doesn't shrink.
 */
export function peekPosition(
  trigger: Rect,
  panel: Size,
  viewport: Size,
): { top: number; left: number; above: boolean } {
  const below = viewport.height - MARGIN - trigger.bottom - GAP;
  const over = trigger.top - GAP - MARGIN;
  const above = panel.height > below && over > below;

  return {
    top: above
      ? Math.max(MARGIN, trigger.top - GAP - panel.height)
      : trigger.bottom + GAP,
    left: Math.min(
      Math.max(MARGIN, trigger.left),
      Math.max(MARGIN, viewport.width - MARGIN - panel.width),
    ),
    above,
  };
}
