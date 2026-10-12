import {
  ReportCategory,
  ReportMotif,
  ReportProfilePart,
  ReportTargetType,
} from "./enums";

/**
 * Which ReportMotif values are valid under each ReportCategory — the single
 * source of truth for both the picker UI (category -> motif options) and
 * server-side validation (ReportService.create rejects a mismatched pair).
 * OTHER maps to an empty list: it has no motif, only the free-text `reason`.
 */
export const REPORT_CATEGORY_MOTIFS: Record<ReportCategory, ReportMotif[]> = {
  SPAM: [
    ReportMotif.SPAM_PROMOTIONAL,
    ReportMotif.SPAM_SUSPICIOUS_LINK,
    ReportMotif.SPAM_REPEATED,
  ],
  ILLEGAL_CONTENT: [
    ReportMotif.ILLEGAL_PIRACY_LINK,
    ReportMotif.ILLEGAL_TERRORISM,
    ReportMotif.ILLEGAL_DEFAMATION,
    ReportMotif.ILLEGAL_OTHER,
  ],
  HARASSMENT: [
    ReportMotif.HARASSMENT_INSULTS,
    ReportMotif.HARASSMENT_THREATS,
    ReportMotif.HARASSMENT_STALKING,
    ReportMotif.HARASSMENT_DOXXING,
  ],
  HATE_SPEECH: [
    ReportMotif.HATE_RACISM,
    ReportMotif.HATE_SEXISM_LGBTQ,
    ReportMotif.HATE_OTHER,
  ],
  SEXUAL_CONTENT: [ReportMotif.SEXUAL_EXPLICIT],
  VIOLENCE: [ReportMotif.VIOLENCE_GRAPHIC],
  MINOR_ENDANGERMENT: [
    ReportMotif.MINOR_ENDANGERMENT_CONTENT,
    ReportMotif.MINOR_ENDANGERMENT_SOLICITATION,
  ],
  SPOILER: [ReportMotif.SPOILER_UNTAGGED],
  IMPERSONATION: [ReportMotif.IMPERSONATION_REAL_PERSON],
  MISINFORMATION: [ReportMotif.MISINFORMATION_FALSE_FACT],
  STOLEN_CONTENT: [
    ReportMotif.STOLEN_CONTENT_PLAGIARIZED,
    ReportMotif.STOLEN_CONTENT_IMAGE,
  ],
  MISLEADING_REVIEW: [
    ReportMotif.MISLEADING_REVIEW_MANIPULATION,
    ReportMotif.MISLEADING_REVIEW_OFF_TOPIC,
  ],
  NONCOMPLIANT_ACCOUNT: [
    ReportMotif.ACCOUNT_BOT,
    ReportMotif.ACCOUNT_UNDERAGE,
    ReportMotif.ACCOUNT_BAN_EVASION,
    ReportMotif.ACCOUNT_MANIPULATION,
  ],
  OTHER: [],
};

/** Motifs whose free-text `reason` is mandatory, like the OTHER category's. */
export const REPORT_MOTIFS_REQUIRING_REASON: ReportMotif[] = [
  ReportMotif.ILLEGAL_OTHER,
];

/**
 * Categories that only make sense for some target types (a comment has no
 * rating to manipulate, a list can't impersonate anyone). Any category not
 * listed applies to every target. Shared by the picker UI and
 * ReportService.create's validation.
 */
const REPORT_CATEGORY_TARGETS: Partial<
  Record<ReportCategory, ReportTargetType[]>
> = {
  MISLEADING_REVIEW: [ReportTargetType.REVIEW],
  SPOILER: [
    ReportTargetType.COMMENT,
    ReportTargetType.REVIEW,
    ReportTargetType.LIST,
  ],
  IMPERSONATION: [
    ReportTargetType.COMMENT,
    ReportTargetType.REVIEW,
    ReportTargetType.USER,
  ],
  MISINFORMATION: [ReportTargetType.COMMENT, ReportTargetType.REVIEW],
  NONCOMPLIANT_ACCOUNT: [ReportTargetType.USER],
};

/** Motifs narrower than their category: only lists and profiles carry an image. */
const REPORT_MOTIF_TARGETS: Partial<Record<ReportMotif, ReportTargetType[]>> = {
  STOLEN_CONTENT_IMAGE: [ReportTargetType.USER, ReportTargetType.LIST],
};

/** The motifs of `category` that apply to `targetType`, in picker order. */
export function reportMotifsFor(
  category: ReportCategory,
  targetType: ReportTargetType,
): ReportMotif[] {
  return REPORT_CATEGORY_MOTIFS[category].filter(
    (motif) => REPORT_MOTIF_TARGETS[motif]?.includes(targetType) ?? true,
  );
}

export const REPORT_PROFILE_PART_CATEGORIES: Record<
  ReportProfilePart,
  ReportCategory[]
> = {
  NAME: [
    "SPAM",
    "ILLEGAL_CONTENT",
    "HARASSMENT",
    "HATE_SPEECH",
    "SEXUAL_CONTENT",
    "IMPERSONATION",
    "OTHER",
  ],
  PHOTO: [
    "ILLEGAL_CONTENT",
    "HATE_SPEECH",
    "SEXUAL_CONTENT",
    "VIOLENCE",
    "MINOR_ENDANGERMENT",
    "IMPERSONATION",
    "STOLEN_CONTENT",
    "OTHER",
  ],
  BIO: [
    "SPAM",
    "ILLEGAL_CONTENT",
    "HARASSMENT",
    "HATE_SPEECH",
    "SEXUAL_CONTENT",
    "MINOR_ENDANGERMENT",
    "STOLEN_CONTENT",
    "OTHER",
  ],
  BEHAVIOUR: [
    "SPAM",
    "HARASSMENT",
    "MINOR_ENDANGERMENT",
    "IMPERSONATION",
    "NONCOMPLIANT_ACCOUNT",
    "OTHER",
  ],
};

export function isReportCategoryAllowed(
  category: ReportCategory,
  targetType: ReportTargetType,
): boolean {
  return REPORT_CATEGORY_TARGETS[category]?.includes(targetType) ?? true;
}
