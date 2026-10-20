import { prefersReducedMotion } from "#lib/motion.js";
import { cubicIn, cubicOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const phase = (elapsed: number, start: number, length: number) =>
  clamp((elapsed - start) / length);

const SLIDE_MS = 180;
const CLOSE_DELAY_MS = 120;
const CLOSE_MS = 200;
const LEAVE_MS = CLOSE_DELAY_MS + CLOSE_MS;

/**
 * A row (or a day section) going: it slides aside and fades, then its height
 * closes so what's below rises into place. `delay` staggers a cascade.
 */
export function rowOut(
  node: HTMLElement,
  { delay = 0 }: { delay?: number } = {},
): TransitionConfig {
  const height = node.offsetHeight;
  return {
    delay: prefersReducedMotion() ? 0 : delay,
    duration: prefersReducedMotion() ? 0 : LEAVE_MS,
    css: (t) => {
      const elapsed = (1 - t) * LEAVE_MS;
      const slide = cubicIn(phase(elapsed, 0, SLIDE_MS));
      const close = cubicIn(phase(elapsed, CLOSE_DELAY_MS, CLOSE_MS));
      return `overflow: hidden; height: ${(1 - close) * height}px; opacity: ${1 - slide}; transform: translateX(${slide * 14}px);`;
    },
  };
}

const ARRIVE_MS = 450;

/**
 * A row (or a day section) coming. A new arrival drops in lit with the
 * accent (`flash`); one loaded with a page or brought back opens quietly.
 */
export function rowIn(
  node: HTMLElement,
  { flash = false }: { flash?: boolean } = {},
): TransitionConfig {
  const height = node.offsetHeight;
  return {
    duration: prefersReducedMotion() ? 0 : flash ? ARRIVE_MS : 240,
    css: (t) => {
      const shown = cubicOut(clamp(t / (flash ? 0.4 : 1)));
      const lit = flash ? `--row-flash: ${(1 - t) * 22}%;` : "";
      return `overflow: hidden; height: ${shown * height}px; opacity: ${shown}; transform: translateY(${(1 - shown) * -6}px); ${lit}`;
    },
  };
}

/** The bell's panel, opening from the corner it hangs from. */
export function panelIn(_node: Element): TransitionConfig {
  return {
    duration: prefersReducedMotion() ? 0 : 220,
    easing: cubicOut,
    css: (t, u) =>
      `opacity: ${t}; transform-origin: top right; transform: translateY(${u * -6}px) scale(${0.97 + 0.03 * t});`,
  };
}

export function panelOut(_node: Element): TransitionConfig {
  return {
    duration: prefersReducedMotion() ? 0 : 150,
    easing: cubicIn,
    css: (t, u) =>
      `opacity: ${t}; transform-origin: top right; transform: translateY(${u * -4}px) scale(${0.98 + 0.02 * t});`,
  };
}

/** The ring that runs out of the bell when something arrives. */
export function glow(element: HTMLElement | null) {
  if (!element || prefersReducedMotion()) return;
  element.animate?.(
    [
      {
        boxShadow:
          "0 0 0 0 color-mix(in srgb, var(--color-accent) 55%, transparent)",
      },
      { boxShadow: "0 0 0 10px transparent" },
    ],
    { duration: 500, easing: "ease-out" },
  );
}
