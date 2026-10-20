export function normalizeWizardIndex(
  stepCount: number,
  activeIndex: number,
): number | null {
  if (stepCount <= 0) return null;
  const integerIndex = Number.isNaN(activeIndex) ? 0 : Math.trunc(activeIndex);
  return Math.min(Math.max(integerIndex, 0), stepCount - 1);
}
