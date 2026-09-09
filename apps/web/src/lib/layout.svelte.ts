import { browser } from "$app/environment";

/**
 * Which of the two navigation shells is mounted (Svelte 5 runes).
 *
 * Two reasons this is a rune rather than a `md:` CSS toggle:
 *
 * - The choice can't be made on width alone. The desktop rail assumes a tall
 *   column; every phone in landscape clears the `md` width threshold (844px
 *   on an iPhone 14, 892 on a Pixel 8) while leaving under 430px of height,
 *   which shows four of ten destinations in a scroller with no visible
 *   scrollbar. The compact shell — bottom bar plus MenuSheet — is built for
 *   those heights.
 * - Rendering both shells and hiding one in CSS duplicated every `id` on the
 *   page, so `#section` links and `aria-describedby` resolved against the
 *   hidden copy instead of the visible one.
 *
 * Content breakpoints stay on width (`sm:`/`md:` grids are right to react to
 * a wide landscape viewport) — only the shell reads this.
 */
const COMPACT_QUERY = "(max-width: 767px), (max-height: 599px)";

class LayoutState {
  /** True while the compact (mobile) shell should be mounted. */
  compact = $state(true);

  init(): void {
    if (!browser) return;

    const query = window.matchMedia(COMPACT_QUERY);
    this.compact = query.matches;
    query.addEventListener("change", (event) => {
      this.compact = event.matches;
    });
  }
}

export const layout = new LayoutState();
