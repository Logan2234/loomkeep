/**
 * Generic Svelte action: moves the node to `document.body` on mount. Used by
 * fixed-position overlays (Drawer, FocusOverlay) so their `position: fixed`
 * is always relative to the viewport — otherwise a `fixed` descendant
 * inherits whatever containing block its parent tree happens to establish
 * (any ancestor with a CSS transform/filter/etc.), which on a tall page
 * misplaces and mis-sizes the element relative to the *document* instead of
 * the screen. Portaling to <body> sidesteps the whole class of bug.
 */
export function portal(node: HTMLElement) {
  document.body.appendChild(node);

  return {
    destroy() {
      node.remove();
    },
  };
}
