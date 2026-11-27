/** How far the indicator has to travel before a release refreshes. */
export const PULL_THRESHOLD = 64;
const PULL_MAX = 96;
/** The finger travels twice as far as the indicator, as a resistance. */
const PULL_RESISTANCE = 0.5;

export const pullDistance = (dragged: number): number =>
  Math.min(Math.max(0, dragged) * PULL_RESISTANCE, PULL_MAX);

/** Whether a touch starting here can pull the page, not something inside it. */
export function canStartPull(target: Element | null, pageTop: number): boolean {
  if (pageTop > 0) return false;

  for (let el = target; el && el !== document.body; el = el.parentElement) {
    if (el.matches("[role='dialog'], input, textarea, select")) return false;
    if (el.scrollTop > 0) return false;
  }

  return true;
}
