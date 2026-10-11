let lockCount = 0;
let previousOverflow = "";

/**
 * Generic Svelte action: locks page scroll for as long as the node stays mounted.
 */
export function scrollLock(_node: HTMLElement) {
  if (lockCount === 0) {
    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
  }

  lockCount++;

  return {
    destroy() {
      lockCount--;

      if (lockCount === 0) {
        document.documentElement.style.overflow = previousOverflow;
      }
    },
  };
}
