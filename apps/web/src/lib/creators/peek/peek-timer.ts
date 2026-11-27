/** Hovering this long on the same name opens its peek. */
export const PEEK_OPEN_DELAY_MS = 500;
/** Time to cross from the name to the peek, or to come back, before it closes. */
export const PEEK_CLOSE_GRACE_MS = 200;

/**
 * When a creator peek opens and closes, apart from the DOM. The target is
 * announced as soon as the pointer arrives, before the peek opens, so its
 * data can start loading during the wait.
 */
export class PeekTimer<T> {
  #target: T | null = null;
  #open = false;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly onChange: (target: T | null, open: boolean) => void,
  ) {}

  /** The pointer or keyboard focus arrived on a trigger. */
  enter(target: T): void {
    this.#clear();

    if (this.#open) {
      // Once one peek is open, the next name opens at once, like a menu bar.
      this.#set(target, true);
      return;
    }

    this.#set(target, false);
    this.#timer = setTimeout(() => this.#set(target, true), PEEK_OPEN_DELAY_MS);
  }

  /** The pointer left a trigger or the peek itself. */
  leave(): void {
    this.#clear();

    if (!this.#open) {
      this.#set(null, false);
      return;
    }

    this.#timer = setTimeout(() => this.#set(null, false), PEEK_CLOSE_GRACE_MS);
  }

  /** The pointer reached the open peek: it stays. */
  hold(): void {
    this.#clear();
  }

  close(): void {
    this.#clear();
    this.#set(null, false);
  }

  #set(target: T | null, open: boolean) {
    this.#timer = null;
    if (target === this.#target && open === this.#open) return;
    this.#target = target;
    this.#open = open;
    this.onChange(target, open);
  }

  #clear() {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
  }
}
