import type { components } from "./generated/schema";
import { typedRequest } from "./generated/typed-request";

export type AccessibilityReport =
  components["schemas"]["AccessibilityReportBody"];

export const reportAccessibility = (body: AccessibilityReport) =>
  typedRequest("/contact/accessibility", {
    method: "POST",
    body,
    withAuth: false,
  });
