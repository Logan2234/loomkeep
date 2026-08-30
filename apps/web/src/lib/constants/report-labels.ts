import { m } from "$lib/paraglide/messages";
import type {
  ModerationLegalBasis,
  ReportCategory,
  ReportMotif,
  ReportStatus,
} from "@loomkeep/shared";

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: m.report_status_pending(),
  RESOLVED: m.report_status_resolved(),
  DISMISSED: m.report_status_dismissed(),
};

export const REPORT_STATUS_COLORS: Record<ReportStatus, string> = {
  PENDING: "border-accent/40 bg-accent/10 text-accent",
  RESOLVED: "border-success/40 bg-success/10 text-success",
  DISMISSED: "border-border bg-surface-2 text-dim",
};

export const REPORT_CATEGORY_ORDER: ReportCategory[] = [
  "SPAM",
  "ILLEGAL_CONTENT",
  "HARASSMENT",
  "HATE_SPEECH",
  "SEXUAL_CONTENT",
  "VIOLENCE",
  "MINOR_ENDANGERMENT",
  "SPOILER",
  "IMPERSONATION",
  "MISINFORMATION",
  "STOLEN_CONTENT",
  "MISLEADING_REVIEW",
  "OTHER",
];

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  SPAM: m.report_category_spam(),
  ILLEGAL_CONTENT: m.report_category_illegal(),
  HARASSMENT: m.report_category_harassment(),
  HATE_SPEECH: m.report_category_hate(),
  SEXUAL_CONTENT: m.report_category_sexual(),
  VIOLENCE: m.report_category_violence(),
  MINOR_ENDANGERMENT: m.report_category_minor(),
  SPOILER: m.report_category_spoiler(),
  IMPERSONATION: m.report_category_impersonation(),
  MISINFORMATION: m.report_category_misinformation(),
  STOLEN_CONTENT: m.report_category_stolen(),
  MISLEADING_REVIEW: m.report_category_misleading_review(),
  OTHER: m.common_other(),
};

export const REPORT_CATEGORY_HINTS: Record<ReportCategory, string> = {
  SPAM: m.report_hint_spam(),
  ILLEGAL_CONTENT: m.report_hint_illegal(),
  HARASSMENT: m.report_hint_harassment(),
  HATE_SPEECH: m.report_hint_hate(),
  SEXUAL_CONTENT: m.report_sexual_explicit(),
  VIOLENCE: m.report_hint_violence(),
  MINOR_ENDANGERMENT: m.report_hint_minor(),
  SPOILER: m.report_hint_spoiler(),
  IMPERSONATION: m.report_hint_impersonation(),
  MISINFORMATION: m.report_false_information(),
  STOLEN_CONTENT: m.report_hint_stolen(),
  MISLEADING_REVIEW: m.report_hint_misleading_review(),
  OTHER: m.report_hint_other(),
};

export const REPORT_MOTIF_LABELS: Record<ReportMotif, string> = {
  SPAM_PROMOTIONAL: m.report_motif_spam_promotional(),
  SPAM_SUSPICIOUS_LINK: m.report_motif_spam_link(),
  SPAM_REPEATED: m.report_motif_spam_repeated(),
  ILLEGAL_PIRACY_LINK: m.report_motif_illegal_link(),
  HARASSMENT_INSULTS: m.report_motif_harassment_insults(),
  HARASSMENT_THREATS: m.report_motif_harassment_threats(),
  HARASSMENT_STALKING: m.report_motif_harassment_stalking(),
  HARASSMENT_DOXXING: m.report_motif_harassment_doxxing(),
  HATE_RACISM: m.report_motif_hate_racism(),
  HATE_SEXISM_LGBTQ: m.report_motif_hate_sexism_lgbtq(),
  HATE_OTHER: m.report_motif_hate_other(),
  SEXUAL_EXPLICIT: m.report_sexual_explicit(),
  VIOLENCE_GRAPHIC: m.report_motif_violence_graphic(),
  MINOR_ENDANGERMENT_CONTENT: m.report_motif_minor_content(),
  MINOR_ENDANGERMENT_SOLICITATION: m.report_motif_minor_solicitation(),
  SPOILER_UNTAGGED: m.report_motif_spoiler(),
  IMPERSONATION_REAL_PERSON: m.report_motif_impersonation_person(),
  IMPERSONATION_FAKE_ACCOUNT: m.report_motif_impersonation_fake(),
  MISINFORMATION_FALSE_FACT: m.report_false_information(),
  STOLEN_CONTENT_PLAGIARIZED: m.report_motif_stolen(),
  MISLEADING_REVIEW_MANIPULATION: m.report_motif_misleading_review(),
};

export const MODERATION_LEGAL_BASIS_LABELS: Record<
  ModerationLegalBasis,
  string
> = {
  ILLEGAL_CONTENT: m.moderation_basis_illegal(),
  TOS_BREACH: m.moderation_basis_terms(),
};

/**
 * Prefills the DSA art. 17 notice fields (§9 CGU) from a report's category,
 * so an admin taking down a comment doesn't retype the same thing every
 * time — still editable before sending. §7 "Règles de conduite" lists every
 * forbidden content type these categories map to.
 */
export function defaultModerationBasis(category: ReportCategory | null): {
  legalBasis: ModerationLegalBasis;
  tosClause: string;
} {
  if (category === "ILLEGAL_CONTENT" || category === "MINOR_ENDANGERMENT") {
    return { legalBasis: "ILLEGAL_CONTENT", tosClause: "" };
  }

  return { legalBasis: "TOS_BREACH", tosClause: m.moderation_terms_conduct() };
}
