/**
 * Whether the row named `anchor` is the one the fragment points at.
 *
 * Split out from the action below because of the empty case: rows that aren't
 * in the settings search index render with no anchor, and a bare `===` would
 * match them all against an empty fragment — every row on the page flashing
 * at once on a plain visit.
 */
export function isFlashTarget(anchor: string, hash: string): boolean {
  return anchor.length > 0 && hash.slice(1) === anchor;
}

/**
 * Brings the element the URL fragment names into view and flashes it once, so
 * a search result that points at one row inside a section says which row it
 * meant. Mount-time only: arriving here is always a navigation.
 */
export function flashAnchor(node: HTMLElement, anchor: string) {
  if (typeof window === "undefined") return;
  if (!isFlashTarget(anchor, window.location.hash)) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // After paint: the section's own content is still settling on mount, and
  // scrolling before it does lands on the wrong offset.
  requestAnimationFrame(() => {
    node.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "center",
    });
    if (reduced) return;
    node.classList.add("setting-flash");
    node.addEventListener(
      "animationend",
      () => node.classList.remove("setting-flash"),
      { once: true },
    );
  });
}
