/**
 * Brings the element the URL fragment names into view and flashes it once, so
 * a search result that points at one row inside a section says which row it
 * meant. Mount-time only: arriving here is always a navigation.
 */
export function flashAnchor(node: HTMLElement, anchor: string) {
  // Rows that aren't in the search index pass "" — without this they would
  // all match an empty fragment and flash at once.
  if (!anchor || typeof window === "undefined") return;
  if (window.location.hash.slice(1) !== anchor) return;

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
