// Five steps on a log scale: one country far ahead (often the US) would
// otherwise leave every other one at the palest step.
const STEPS = [22, 38, 55, 75, 100];

/** The fill of a country on the stats map, `value` out of the top `max`. */
export function countryShade(value: number, max: number): string {
  const ratio = Math.log(value + 1) / Math.log(Math.max(max, 1) + 1);
  const step = Math.min(STEPS.length - 1, Math.floor(ratio * STEPS.length));
  return `color-mix(in srgb, var(--accent) ${STEPS[step]}%, var(--surface-2))`;
}
