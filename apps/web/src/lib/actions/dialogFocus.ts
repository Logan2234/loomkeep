type DialogFocusOptions = {
  initialFocus?: HTMLElement | null;
  onEscape?: () => void;
};

type InertState = { count: number; wasInert: boolean };

const dialogs: HTMLElement[] = [];
const inertStates = new Map<HTMLElement, InertState>();

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function nextFocusIndex(
  currentIndex: number,
  focusableCount: number,
  reverse: boolean,
): number {
  if (focusableCount === 0) return -1;
  if (currentIndex < 0) return reverse ? focusableCount - 1 : 0;
  return reverse
    ? (currentIndex - 1 + focusableCount) % focusableCount
    : (currentIndex + 1) % focusableCount;
}

function isAvailable(element: HTMLElement): boolean {
  return (
    element.tabIndex >= 0 &&
    !element.hasAttribute("disabled") &&
    element.getAttribute("aria-disabled") !== "true" &&
    !element.inert &&
    element.getClientRects().length > 0
  );
}

function focusableElements(node: HTMLElement): HTMLElement[] {
  return Array.from(
    node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(isAvailable);
}

function backgroundSiblings(node: HTMLElement): HTMLElement[] {
  const siblings = new Set<HTMLElement>();
  let current: HTMLElement | null = node;
  let directSiblings = true;

  while (current?.parentElement) {
    const parentElement: HTMLElement = current.parentElement;

    for (const child of parentElement.children) {
      if (
        child !== current &&
        child instanceof HTMLElement &&
        !(directSiblings && child.hasAttribute("data-dialog-backdrop"))
      ) {
        siblings.add(child);
      }
    }

    if (parentElement === document.body) break;
    current = parentElement;
    directSiblings = false;
  }

  return [...siblings];
}

function makeInert(elements: HTMLElement[]) {
  for (const element of elements) {
    const state = inertStates.get(element);

    if (state) {
      state.count++;
    } else {
      inertStates.set(element, { count: 1, wasInert: element.inert });
      element.inert = true;
    }
  }
}

function restoreInert(elements: HTMLElement[]) {
  for (const element of elements) {
    const state = inertStates.get(element);
    if (!state) continue;
    state.count--;

    if (state.count === 0) {
      element.inert = state.wasInert;
      inertStates.delete(element);
    }
  }
}

export function dialogFocus(
  node: HTMLElement,
  options: DialogFocusOptions = {},
) {
  let currentOptions = options;
  const trigger =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const inertElements = backgroundSiblings(node);
  const hadTabindex = node.hasAttribute("tabindex");
  const previousTabindex = node.getAttribute("tabindex");

  if (!hadTabindex) node.setAttribute("tabindex", "-1");
  dialogs.push(node);
  makeInert(inertElements);

  const isTopmost = () => dialogs.at(-1) === node;

  const focusInitial = () => {
    if (!isTopmost()) return;
    const requested = currentOptions.initialFocus;
    const target =
      requested &&
      node.contains(requested) &&
      !requested.hasAttribute("disabled") &&
      requested.getAttribute("aria-disabled") !== "true" &&
      !requested.inert
        ? requested
        : (focusableElements(node)[0] ?? node);
    target.focus({ preventScroll: true });
  };

  const onKeydown = (event: KeyboardEvent) => {
    if (!isTopmost()) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      currentOptions.onEscape?.();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = focusableElements(node);
    event.preventDefault();
    const currentIndex = focusable.indexOf(
      document.activeElement as HTMLElement,
    );
    const nextIndex = nextFocusIndex(
      currentIndex,
      focusable.length,
      event.shiftKey,
    );
    (nextIndex === -1 ? node : focusable[nextIndex]).focus({
      preventScroll: true,
    });
  };

  const onFocusIn = (event: FocusEvent) => {
    if (isTopmost() && !node.contains(event.target as Node)) focusInitial();
  };

  document.addEventListener("keydown", onKeydown, true);
  document.addEventListener("focusin", onFocusIn, true);
  queueMicrotask(() => requestAnimationFrame(focusInitial));

  return {
    update(nextOptions: DialogFocusOptions = {}) {
      currentOptions = nextOptions;
    },
    destroy() {
      document.removeEventListener("keydown", onKeydown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      const index = dialogs.lastIndexOf(node);
      if (index !== -1) dialogs.splice(index, 1);
      restoreInert(inertElements);

      if (!hadTabindex) node.removeAttribute("tabindex");
      else if (previousTabindex !== null)
        node.setAttribute("tabindex", previousTabindex);

      if (trigger?.isConnected && !trigger.inert) {
        queueMicrotask(() => trigger.focus({ preventScroll: true }));
      }
    },
  };
}
