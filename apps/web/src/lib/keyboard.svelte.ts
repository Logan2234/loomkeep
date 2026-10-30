import { browser } from "$app/env";

// The Android app shrinks the whole WebView when the keyboard opens
// (Capacitor pads the window by the keyboard's height), so a fixed bottom
// bar rides on top of it. No event says "keyboard": a typing field holding
// focus while the page has lost a keyboard's worth of height is the sign.
// A browser overlays its keyboard instead and never trips this.
const KEYBOARD_MIN_HEIGHT = 150;

export const isKeyboardOpen = ({
  tallest,
  height,
  typing,
}: {
  /** The tallest the page has been at its current width. */
  tallest: number;
  height: number;
  typing: boolean;
}): boolean => typing && tallest - height > KEYBOARD_MIN_HEIGHT;

function isTypingField(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement)
    return ![
      "checkbox",
      "radio",
      "button",
      "submit",
      "range",
      "file",
      "color",
    ].includes(element.type);
  return element instanceof HTMLElement && element.isContentEditable;
}

class KeyboardState {
  open = $state(false);

  /** Returns the teardown for an `$effect`. */
  init(): () => void {
    if (!browser) return () => {};

    let width = innerWidth;
    let tallest = innerHeight;

    const update = () => {
      // A rotation changes what "full height" means.
      if (innerWidth !== width) {
        width = innerWidth;
        tallest = innerHeight;
      }

      tallest = Math.max(tallest, innerHeight);
      this.open = isKeyboardOpen({
        tallest,
        height: innerHeight,
        typing: isTypingField(document.activeElement),
      });
    };

    // focusout fires before focus lands on its next element.
    const updateLater = () => setTimeout(update);

    addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", updateLater);

    return () => {
      removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", updateLater);
    };
  }
}

export const keyboard = new KeyboardState();
