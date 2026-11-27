export type PageTransition = "forward" | "back" | "fade";

const depth = (pathname: string) => pathname.split("/").filter(Boolean).length;

/**
 * Deeper slides forward, shallower or the back button slides back, and a page
 * at the same level (two bottom tabs, say) only fades.
 */
export function pageTransition(
  from: string,
  to: string,
  historyDelta?: number,
): PageTransition {
  if (historyDelta !== undefined && historyDelta < 0) return "back";
  if (depth(to) > depth(from)) return "forward";
  return depth(to) < depth(from) ? "back" : "fade";
}
