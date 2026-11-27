export const SEARCH_DEBOUNCE_MS = 300;

// Tiny debounce helper for the search panels: coalesces rapid calls into one
// deferred call, with an explicit cancel for cleanup / eager paths.

export interface Debounced<A extends unknown[]> {
  /** Schedule `fn(...args)`, cancelling any pending call. */
  call: (...args: A) => void;
  /** Cancel a pending call, if any. */
  cancel: () => void;
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    call(...args: A) {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    },
    cancel() {
      clearTimeout(timer);
    },
  };
}
