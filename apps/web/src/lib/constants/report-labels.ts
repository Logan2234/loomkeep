// French labels for the report category/motif picker (CommentThread.svelte
// today; any future REVIEW/USER/LIST report button reuses the same picker).

import { m } from "$lib/paraglide/messages";
import type {
  ModerationLegalBasis,
  ReportCategory,
  ReportMotif,
  ReportStatus,
} from "@loomkeep/shared";

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: "En attente",
  RESOLVED: "Résolu",
  DISMISSED: "Rejeté",
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
  SPAM: "Spam ou publicité",
  ILLEGAL_CONTENT: "Contenu illégal",
  HARASSMENT: "Harcèlement",
  HATE_SPEECH: "Discours haineux",
  SEXUAL_CONTENT: "Contenu sexuel",
  VIOLENCE: "Violence ou contenu choquant",
  MINOR_ENDANGERMENT: "Mise en danger d'un mineur",
  SPOILER: "Spoiler non signalé",
  IMPERSONATION: "Usurpation d'identité",
  MISINFORMATION: "Désinformation",
  STOLEN_CONTENT: "Contenu volé",
  MISLEADING_REVIEW: "Avis trompeur",
  OTHER: m.common_other(),
};

// One-line scent shown under each category name in the picker, so 13 rows
// scan fast without needing icons the user hasn't learned yet.
export const REPORT_CATEGORY_HINTS: Record<ReportCategory, string> = {
  SPAM: "Publicité, lien suspect, messages répétés",
  ILLEGAL_CONTENT: "Piratage, streaming illégal",
  HARASSMENT: "Insultes, menaces, intimidation, doxxing",
  HATE_SPEECH: "Racisme, sexisme, homophobie…",
  SEXUAL_CONTENT: "Contenu à caractère sexuel explicite",
  VIOLENCE: "Violence ou contenu graphique",
  MINOR_ENDANGERMENT: "Contenu ou sollicitation impliquant un mineur",
  SPOILER: "Révèle l'intrigue sans balise",
  IMPERSONATION: "Faux compte ou usurpation",
  MISINFORMATION: "Fausse information présentée comme un fait",
  STOLEN_CONTENT: "Texte copié sans attribution",
  MISLEADING_REVIEW: "Faux avis, notation manipulée",
  OTHER: "Autre chose — explique en quelques mots",
};

export const REPORT_MOTIF_LABELS: Record<ReportMotif, string> = {
  SPAM_PROMOTIONAL: "Contenu publicitaire non sollicité",
  SPAM_SUSPICIOUS_LINK: "Lien suspect ou malveillant",
  SPAM_REPEATED: "Messages répétés (flood)",
  ILLEGAL_PIRACY_LINK: "Lien de piratage ou de streaming illégal",
  HARASSMENT_INSULTS: "Insultes ou propos dégradants ciblés",
  HARASSMENT_THREATS: "Menaces",
  HARASSMENT_STALKING: "Intimidation répétée / acharnement",
  HARASSMENT_DOXXING: "Partage d'informations personnelles (doxxing)",
  HATE_RACISM: "Racisme ou xénophobie",
  HATE_SEXISM_LGBTQ: "Sexisme, homophobie ou transphobie",
  HATE_OTHER: "Autre forme de discrimination",
  SEXUAL_EXPLICIT: "Contenu à caractère sexuel explicite",
  VIOLENCE_GRAPHIC: "Violence ou contenu graphique choquant",
  MINOR_ENDANGERMENT_CONTENT:
    "Contenu montrant un mineur en danger ou exploité",
  MINOR_ENDANGERMENT_SOLICITATION: "Sollicitation impliquant un mineur",
  SPOILER_UNTAGGED: "Révèle un élément d'intrigue sans balise",
  IMPERSONATION_REAL_PERSON:
    "Se fait passer pour une personne réelle ou un autre membre",
  IMPERSONATION_FAKE_ACCOUNT: "Faux compte ou bot",
  MISINFORMATION_FALSE_FACT: "Fausse information présentée comme un fait",
  STOLEN_CONTENT_PLAGIARIZED: "Texte copié d'ailleurs sans attribution",
  MISLEADING_REVIEW_MANIPULATION: "Faux avis ou manipulation de la note",
};

export const MODERATION_LEGAL_BASIS_LABELS: Record<
  ModerationLegalBasis,
  string
> = {
  ILLEGAL_CONTENT: "Contenu manifestement illégal",
  TOS_BREACH: "Violation des CGU",
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

  return { legalBasis: "TOS_BREACH", tosClause: "§7 — Règles de conduite" };
}
