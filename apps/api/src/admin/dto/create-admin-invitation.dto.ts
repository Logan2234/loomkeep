import type { CreateAdminInvitationRequestDto } from "@loomkeep/shared";
import {
  INVITATION_LABEL_MAX_LENGTH,
  INVITATION_MAX_USES,
  INVITATION_VALIDITY_DAYS,
} from "@loomkeep/shared";
import { Transform } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { normalizeEmail } from "../../common/email.util";

export class CreateAdminInvitationDto implements CreateAdminInvitationRequestDto {
  // An empty field in the form means "no address": a link shared by hand.
  @Transform(({ value }) => normalizeEmail(value) || undefined)
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(INVITATION_LABEL_MAX_LENGTH)
  label?: string;

  @IsInt()
  @Min(1)
  @Max(INVITATION_MAX_USES)
  maxUses!: number;

  @IsIn(INVITATION_VALIDITY_DAYS)
  validityDays!: number;
}
