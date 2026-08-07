// Generic Svelte action: moves the node to `document.body` on mount. Used by
// fixed-position overlays (Drawer, FocusOverlay) so their `position: fixed`
// is always relative to the viewport — otherwise a `fixed` descendant
// inherits whatever containing block its parent tree happens to establish
// (any ancestor with a CSS transform/filter/etc.), which on a tall page
// misplaces and mis-sizes the element relative to the *document* instead of
// the screen. Portaling to <body> sidesteps the whole class of bug.
export function portal(node: HTMLElement) {
  document.body.appendChild(node);

  // Explicit removal on destroy, not a re-parent back to the original slot:
  // moving it back would race Svelte's own teardown (the node would
  // reappear in the component tree *after* Svelte already destroyed its
  // reactivity/handlers for it, leaving a dead, unclickable remnant behind —
  // confirmed live in an earlier version of this component). A plain
  // `.remove()` doesn't have that problem — it never becomes visible again
  // anywhere, so there's nothing to race. Added as a guaranteed fallback
  // after a case where a client-side route change away from the page that
  // opened a Drawer left it visibly stuck (portal.ts docs already flagged
  // this general class of bug; relying solely on Svelte's own teardown to
  // reach a body-portaled node during a same-navigation unmount wasn't
  // reliable enough).
  return {
    destroy() {
      node.remove();
    },
  };
}
