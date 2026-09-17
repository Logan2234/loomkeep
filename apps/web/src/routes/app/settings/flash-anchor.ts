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

export interface FlashAnchorArgs {
  anchor: string;
  /** The live fragment, so the action re-runs when only the hash changes. */
  hash: string;
}

/**
 * Brings the row the URL fragment names into view and flashes it once, so a
 * search result that points at one control inside a section says which one it
 * meant.
 *
 * Driven by the hash passed in rather than read off `location`: clicking a
 * result for the section you are already on changes only the fragment, which
 * doesn't remount anything, so a mount-only version silently did nothing in
 * exactly the case the search makes easy to hit.
 */
export function flashAnchor(node: HTMLElement, args: FlashAnchorArgs) {
  let lastHash: string | null = null;

  function run({ anchor, hash }: FlashAnchorArgs) {
    if (hash === lastHash) return;
    lastHash = hash;
    if (typeof window === "undefined") return;
    if (!isFlashTarget(anchor, hash)) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // After paint: the section's own content is still settling on mount, and
    // scrolling before it does lands on the wrong offset.
    requestAnimationFrame(() => {
      node.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "center",
      });
      if (reduced) return;
      // Restart the animation even if the same row is targeted twice.
      node.classList.remove("setting-flash");
      void node.offsetWidth;
      node.classList.add("setting-flash");
      node.addEventListener(
        "animationend",
        () => node.classList.remove("setting-flash"),
        { once: true },
      );
    });
  }

  run(args);

  return { update: run };
}
