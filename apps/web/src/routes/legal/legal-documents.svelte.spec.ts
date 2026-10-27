import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import LegalNoticePage from "./legal-notice/+page.svelte";
import PrivacyPolicyPage from "./privacy-policy/+page.svelte";
import TermsOfServicePage from "./terms-of-service/+page.svelte";

// These three are written in French only, while <html lang> follows the
// visitor's locale (English by default): without their own lang, a screen
// reader reads the French with English pronunciation.
describe.each([
  ["legal notice", LegalNoticePage],
  ["privacy policy", PrivacyPolicyPage],
  ["terms of service", TermsOfServicePage],
])("%s", (_name, Page) => {
  it("declares its French text as French", () => {
    render(Page);

    expect(screen.getByRole("main").getAttribute("lang")).toBe("fr");
  });
});
