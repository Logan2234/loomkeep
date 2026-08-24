// Svelte's built-in transitions are JS-driven and don't honor
// prefers-reduced-motion on their own, so every transition/animate duration
// added to the app is gated through this snapshot instead.
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
