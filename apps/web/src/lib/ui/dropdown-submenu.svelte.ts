// The one submenu open at a time, across a Dropdown's DropdownSubmenus:
// opening one closes its sibling at once rather than letting both overlap.
/** Context key: whether the enclosing Dropdown is drawn as a phone's sheet. */
export const IN_MENU_SHEET = Symbol("in-menu-sheet");

export const openSubmenu = $state<{ id: symbol | null }>({ id: null });

/** Renders a node under <body>, out of any transformed or clipping ancestor. */
export function portal(node: HTMLElement) {
  document.body.appendChild(node);
  return {
    destroy() {
      node.remove();
    },
  };
}
