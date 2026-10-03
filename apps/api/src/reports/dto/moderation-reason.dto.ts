import { ModerationLegalBasis } from "@loomkeep/shared";
import { IsIn, IsString, MinLength, ValidateIf } from "class-validator";

/**
 * The DSA art. 17 "facts and legal basis" an admin must supply when taking a
 * restrictive measure (comment take-down or account deletion) — reused by
 * both AdminReportsController and AdminUsersController since the shape is
 * identical either way. See ModerationDecisionService.record.
 */
export class ModerationReasonBody {
  @IsString()
  @MinLength(1)
  reasonText!: string;

  @IsIn([ModerationLegalBasis.ILLEGAL_CONTENT, ModerationLegalBasis.TOS_BREACH])
  legalBasis!: ModerationLegalBasis;

  /** The CGU clause breached — only asked for a TOS_BREACH measure. */
  @ValidateIf(
    (body: ModerationReasonBody) =>
      body.legalBasis === ModerationLegalBasis.TOS_BREACH,
  )
  @IsString()
  @MinLength(1)
  tosClause?: string;
}
