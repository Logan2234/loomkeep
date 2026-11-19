import { m } from "#lib/paraglide/messages.js";
import { type SelectOption } from "#lib/types/select-option.js";
import type {
  ModerationLegalBasis,
  ReportCategory,
  ReportMotif,
  ReportProfilePart,
  ReportStatus,
  ReportTargetType,
} from "@loomkeep/shared";

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  get PENDING() {
    return m.common_pending();
  },
  get RESOLVED() {
    return m.report_status_resolved();
  },
  get DISMISSED() {
    return m.report_status_dismissed();
  },
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
  "NONCOMPLIANT_ACCOUNT",
  "OTHER",
];

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  get SPAM() {
    return m.report_category_spam();
  },
  get ILLEGAL_CONTENT() {
    return m.report_category_illegal();
  },
  get HARASSMENT() {
    return m.report_category_harassment();
  },
  get HATE_SPEECH() {
    return m.report_category_hate();
  },
  get SEXUAL_CONTENT() {
    return m.report_category_sexual();
  },
  get VIOLENCE() {
    return m.report_category_violence();
  },
  get MINOR_ENDANGERMENT() {
    return m.report_category_minor();
  },
  get SPOILER() {
    return m.report_category_spoiler();
  },
  get IMPERSONATION() {
    return m.report_category_impersonation();
  },
  get MISINFORMATION() {
    return m.report_category_misinformation();
  },
  get STOLEN_CONTENT() {
    return m.report_category_stolen();
  },
  get MISLEADING_REVIEW() {
    return m.report_category_misleading_review();
  },
  get NONCOMPLIANT_ACCOUNT() {
    return m.report_category_noncompliant();
  },
  get OTHER() {
    return m.common_other();
  },
};

export const REPORT_CATEGORY_HINTS: Record<ReportCategory, string> = {
  get SPAM() {
    return m.report_hint_spam();
  },
  get ILLEGAL_CONTENT() {
    return m.report_hint_illegal();
  },
  get HARASSMENT() {
    return m.report_hint_harassment();
  },
  get HATE_SPEECH() {
    return m.report_hint_hate();
  },
  get SEXUAL_CONTENT() {
    return m.report_sexual_explicit();
  },
  get VIOLENCE() {
    return m.report_hint_violence();
  },
  get MINOR_ENDANGERMENT() {
    return m.report_hint_minor();
  },
  get SPOILER() {
    return m.report_hint_spoiler();
  },
  get IMPERSONATION() {
    return m.report_hint_impersonation();
  },
  get MISINFORMATION() {
    return m.report_false_information();
  },
  get STOLEN_CONTENT() {
    return m.report_hint_stolen();
  },
  get MISLEADING_REVIEW() {
    return m.report_hint_misleading_review();
  },
  get NONCOMPLIANT_ACCOUNT() {
    return m.report_hint_noncompliant();
  },
  get OTHER() {
    return m.report_hint_other();
  },
};

export const REPORT_MOTIF_LABELS: Record<ReportMotif, string> = {
  get SPAM_PROMOTIONAL() {
    return m.report_motif_spam_promotional();
  },
  get SPAM_SUSPICIOUS_LINK() {
    return m.report_motif_spam_link();
  },
  get SPAM_REPEATED() {
    return m.report_motif_spam_repeated();
  },
  get ILLEGAL_PIRACY_LINK() {
    return m.report_motif_illegal_link();
  },
  get ILLEGAL_TERRORISM() {
    return m.report_motif_illegal_terrorism();
  },
  get ILLEGAL_DEFAMATION() {
    return m.report_motif_illegal_defamation();
  },
  get ILLEGAL_OTHER() {
    return m.report_motif_illegal_other();
  },
  get HARASSMENT_INSULTS() {
    return m.report_motif_harassment_insults();
  },
  get HARASSMENT_THREATS() {
    return m.report_motif_harassment_threats();
  },
  get HARASSMENT_STALKING() {
    return m.report_motif_harassment_stalking();
  },
  get HARASSMENT_DOXXING() {
    return m.report_motif_harassment_doxxing();
  },
  get HATE_RACISM() {
    return m.report_motif_hate_racism();
  },
  get HATE_SEXISM_LGBTQ() {
    return m.report_motif_hate_sexism_lgbtq();
  },
  get HATE_OTHER() {
    return m.report_motif_hate_other();
  },
  get SEXUAL_EXPLICIT() {
    return m.report_sexual_explicit();
  },
  get VIOLENCE_GRAPHIC() {
    return m.report_motif_violence_graphic();
  },
  get MINOR_ENDANGERMENT_CONTENT() {
    return m.report_motif_minor_content();
  },
  get MINOR_ENDANGERMENT_SOLICITATION() {
    return m.report_motif_minor_solicitation();
  },
  get SPOILER_UNTAGGED() {
    return m.report_motif_spoiler();
  },
  get IMPERSONATION_REAL_PERSON() {
    return m.report_motif_impersonation_person();
  },
  get MISINFORMATION_FALSE_FACT() {
    return m.report_false_information();
  },
  get STOLEN_CONTENT_PLAGIARIZED() {
    return m.report_motif_stolen();
  },
  get STOLEN_CONTENT_IMAGE() {
    return m.report_motif_stolen_image();
  },
  get MISLEADING_REVIEW_MANIPULATION() {
    return m.report_motif_misleading_review();
  },
  get MISLEADING_REVIEW_OFF_TOPIC() {
    return m.report_motif_misleading_off_topic();
  },
  get ACCOUNT_BOT() {
    return m.report_motif_account_bot();
  },
  get ACCOUNT_UNDERAGE() {
    return m.report_motif_account_underage();
  },
  get ACCOUNT_BAN_EVASION() {
    return m.report_motif_account_ban_evasion();
  },
  get ACCOUNT_MANIPULATION() {
    return m.report_motif_account_manipulation();
  },
};

/** The "what's wrong?" step of a profile report, in display order. */
export const REPORT_PROFILE_PARTS: (SelectOption<ReportProfilePart> & {
  hint: string;
})[] = [
  {
    value: "NAME",
    get label() {
      return m.common_name();
    },
    get hint() {
      return m.report_part_name_hint();
    },
  },
  {
    value: "PHOTO",
    get label() {
      return m.report_part_photo();
    },
    get hint() {
      return m.report_part_photo_hint();
    },
  },
  {
    value: "BIO",
    get label() {
      return m.common_bio();
    },
    get hint() {
      return m.report_part_bio_hint();
    },
  },
  {
    value: "BEHAVIOUR",
    get label() {
      return m.report_part_behaviour();
    },
    get hint() {
      return m.report_part_behaviour_hint();
    },
  },
];

// Getters, so each label follows the locale it is read in.
export const REPORT_PROFILE_PART_LABELS = Object.defineProperties(
  {} as Record<ReportProfilePart, string>,
  Object.fromEntries(
    REPORT_PROFILE_PARTS.map((part) => [
      part.value,
      { enumerable: true, get: () => part.label },
    ]),
  ),
);

export const REPORT_TARGET_LABELS: Record<ReportTargetType, string> = {
  get COMMENT() {
    return m.report_target_comment();
  },
  get REVIEW() {
    return m.report_target_review();
  },
  get USER() {
    return m.report_target_user();
  },
  get LIST() {
    return m.report_target_list();
  },
  get MESSAGE() {
    return m.report_target_message();
  },
};

export const MODERATION_LEGAL_BASIS_LABELS: Record<
  ModerationLegalBasis,
  string
> = {
  get ILLEGAL_CONTENT() {
    return m.moderation_basis_illegal();
  },
  get TOS_BREACH() {
    return m.moderation_basis_terms();
  },
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

  if (category === "NONCOMPLIANT_ACCOUNT") {
    return { legalBasis: "TOS_BREACH", tosClause: m.moderation_terms_abuse() };
  }

  return { legalBasis: "TOS_BREACH", tosClause: m.moderation_terms_conduct() };
}
