const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const dialogStack: HTMLElement[] = [];

function focusableElements(node: HTMLElement): HTMLElement[] {
  return Array.from(
    node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      element.getAttribute("aria-hidden") !== "true" &&
      element.getClientRects().length > 0,
  );
}

function focusFirst(node: HTMLElement) {
  const autofocus = node.querySelector<HTMLElement>("[autofocus]");
  (autofocus ?? focusableElements(node)[0] ?? node).focus();
}

/** Keeps keyboard focus in the topmost dialog and restores it on close. */
export function dialogFocus(node: HTMLElement) {
  const previouslyFocused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  dialogStack.push(node);

  const isTopmost = () => dialogStack.at(-1) === node;

  function handleKeydown(event: KeyboardEvent) {
    if (!isTopmost() || event.key !== "Tab") return;

    const focusable = focusableElements(node);

    if (focusable.length === 0) {
      event.preventDefault();
      node.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1) as HTMLElement;
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !node.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !node.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleFocusIn(event: FocusEvent) {
    if (!isTopmost() || node.contains(event.target as Node)) return;
    focusFirst(node);
  }

  node.addEventListener("keydown", handleKeydown);
  document.addEventListener("focusin", handleFocusIn, true);
  queueMicrotask(() => {
    if (isTopmost()) focusFirst(node);
  });

  return {
    destroy() {
      const index = dialogStack.lastIndexOf(node);
      const wasTopmost = index === dialogStack.length - 1;
      if (index !== -1) dialogStack.splice(index, 1);

      node.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("focusin", handleFocusIn, true);

      if (wasTopmost) {
        queueMicrotask(() => {
          if (previouslyFocused?.isConnected) previouslyFocused.focus();
          else dialogStack.at(-1)?.focus();
        });
      }
    },
  };
}
