import { renderWithQuery } from "#lib/test/render.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import OnboardingWizard from "./OnboardingWizard.svelte";

vi.mock("$app/env", () => ({ browser: true, dev: false }));

afterEach(() => vi.restoreAllMocks());

describe("onboarding storage", () => {
  it("can open when the browser refuses access to stored progress", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    expect(() => renderWithQuery(OnboardingWizard, {})).not.toThrow();
  });
});
