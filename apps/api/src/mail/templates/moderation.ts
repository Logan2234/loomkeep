import { type Locale } from "@loomkeep/shared/catalog";
import {
  ModerationLegalBasis,
  ModerationMeasure,
} from "@loomkeep/shared/enums";
import { resolveCopyLocale } from "../../common/copy-locale.util";
import { DEFAULT_SUPPORT_ADDRESS } from "../../common/instance-defaults";
import { COLOR_MUTED, escapeHtml } from "../mail-html";
import { MailLayout } from "../mail-layout";
import { MAIL_COPY } from "../mail.i18n";
import type { ModerationDecisionMail, TemplateBody } from "../mail.types";

// The DSA art. 17 notice a moderation decision sends its target.

/**
 * The five DSA art. 17 mentions: nature of the measure, facts invoked,
 * legal/contractual basis, non-automated character, redress. `tosClause`
 * is only meaningful when legalBasis is TOS_BREACH — ILLEGAL_CONTENT states
 * the illegality ground instead. Several measures taken on one report share
 * one notice, which names each of them.
 */
export function buildModerationDecision(
  layout: MailLayout,

  locale: Locale,
  input: ModerationDecisionMail,
): TemplateBody {
  const copy = MAIL_COPY[resolveCopyLocale(locale)].moderation;
  const until = input.suspendedUntil
    ? layout.formatEventDate(locale, input.suspendedUntil)
    : "";
  const variants = input.measures.map((measure) =>
    measure === ModerationMeasure.ACCOUNT_SUSPENDED
      ? {
          measure: copy.suspended.measure(until),
          subject: copy.suspended.subject,
        }
      : {
          [ModerationMeasure.COMMENT_REMOVED]: copy.comment,
          [ModerationMeasure.MESSAGE_REMOVED]: copy.message,
          [ModerationMeasure.REVIEW_REMOVED]: copy.review,
          [ModerationMeasure.LIST_REMOVED]: copy.listRemoved,
          [ModerationMeasure.LIST_EDITED]: copy.listEdited,
          [ModerationMeasure.AVATAR_REMOVED]: copy.avatar,
          [ModerationMeasure.BIO_CLEARED]: copy.bio,
          [ModerationMeasure.DISPLAY_NAME_CHANGED]: copy.displayName,
          [ModerationMeasure.ACCOUNT_DELETED]: copy.account,
        }[measure],
  );
  const subject =
    variants.length === 1 ? variants[0].subject : copy.severalSubject;
  const measures = variants.map((v) => v.measure);
  const measureText =
    measures.length > 1
      ? `${measures.slice(0, -1).join(", ")} ${copy.and} ${measures.at(-1)}`
      : measures[0];
  const basisText =
    input.legalBasis === ModerationLegalBasis.ILLEGAL_CONTENT
      ? copy.illegalBasis
      : copy.tosBasis(input.tosClause);
  const intro = copy.intro(measureText);
  const reference = copy.reference(input.decisionIds.join(", "));
  const decidedAt = copy.decidedAt(
    layout.formatEventDate(locale, input.decidedAt),
  );
  const appeal = copy.appeal.replace(
    DEFAULT_SUPPORT_ADDRESS,
    layout.supportAddress,
  );

  return {
    subject,
    text: `${reference}\n${decidedAt}\n\n${intro}\n\n${copy.factsLabel}: ${input.reasonText}\n\n${copy.basisLabel}: ${basisText}.\n\n${copy.humanDecision}\n\n${appeal}`,
    html: layout.wrapEmail(
      locale,
      subject,
      `<p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(reference)}<br>${escapeHtml(decidedAt)}</p>
         <p>${escapeHtml(intro)}</p>
         <p><strong>${escapeHtml(copy.factsLabel)}:</strong> ${escapeHtml(input.reasonText)}</p>
         <p><strong>${escapeHtml(copy.basisLabel)}:</strong> ${escapeHtml(basisText)}.</p>
         <p style="color:${COLOR_MUTED};font-size:13px;">${escapeHtml(copy.humanDecision)}</p>
         <p>${escapeHtml(appeal)}</p>`,
      {
        template: "moderationDecision",
        footer: { type: "moderation", decisionId: input.decisionIds[0] },
      },
    ),
  };
}
