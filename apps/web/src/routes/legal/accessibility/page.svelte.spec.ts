import { m } from "#lib/paraglide/messages.js";
import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import AccessibilityPage from "./+page.svelte";

describe("accessibility statement", () => {
  it("says what is checked, what isn't, and where to report a barrier", () => {
    render(AccessibilityPage);

    for (const heading of [
      m.accessibility_tested_heading(),
      m.accessibility_untested_heading(),
      m.accessibility_report_heading(),
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }

    expect(
      screen
        .getByRole("link", { name: "contact@loomkeep.app" })
        .getAttribute("href"),
    ).toBe("mailto:contact@loomkeep.app");
    expect(
      screen.getByRole("link", { name: "feedback.loomkeep.app" }),
    ).toBeTruthy();
  });
});
