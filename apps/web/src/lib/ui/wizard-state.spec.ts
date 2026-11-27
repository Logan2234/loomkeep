import { describe, expect, it } from "vitest";
import { normalizeWizardIndex } from "./wizard-state";

describe("normalizeWizardIndex", () => {
  it("returns null when the wizard has no steps", () => {
    expect(normalizeWizardIndex(0, 0)).toBeNull();
  });

  it("keeps valid indices and clamps invalid ones", () => {
    expect(normalizeWizardIndex(3, 1)).toBe(1);
    expect(normalizeWizardIndex(3, -1)).toBe(0);
    expect(normalizeWizardIndex(3, 8)).toBe(2);
    expect(normalizeWizardIndex(3, 1.8)).toBe(1);
    expect(normalizeWizardIndex(3, Number.NaN)).toBe(0);
  });
});
