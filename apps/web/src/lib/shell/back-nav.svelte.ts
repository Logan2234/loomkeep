// Tracks whether the current tab has any in-app navigation history, so a
// "back" link can prefer the browser's real back navigation (which restores
// the previous page's URL — including its filters/sort/search, synced there
// via replaceState) over a hardcoded fallback route. Call `trackBackHistory`
// once, from the /app root layout, to start tracking for the whole SPA area.
import { afterNavigate } from "$app/navigation";

let hasInternalHistory = $state(false);
let previousPath: string | null = null;

export function trackBackHistory() {
  afterNavigate(({ from }) => {
    if (from?.url) {
      hasInternalHistory = true;
      previousPath = from.url.pathname;
    }
  });
}

// Use on a back link's `<a href={fallback}>`: goes back in history when we
// know that lands inside the app (this tab navigated here rather than
// loading it fresh), otherwise lets the plain href navigate normally.
export function goBack(event: MouseEvent) {
  if (hasInternalHistory) {
    event.preventDefault();
    history.back();
  }
}

// Use on a link to the parent page: coming from that parent, steps back rather
// than pushing it again. Otherwise the parent's own history-based "<" would
// lead straight back here, and the two pages would bounce.
export function goUp(event: MouseEvent, parent: string) {
  if (previousPath === parent.split(/[?#]/)[0]) {
    event.preventDefault();
    history.back();
  }
}
