import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { ModerationReasonBody } from "./moderation-reason.dto";

/**
 * The measures an admin takes on a reported profile, any combination at
 * once, all sharing one statement of facts and basis. Deleting the account
 * stays its own endpoint (AdminUsersController.deleteUser).
 */
export class ProfileMeasuresBody extends ModerationReasonBody {
  @IsOptional()
  @IsBoolean()
  removeAvatar?: boolean;

  @IsOptional()
  @IsBoolean()
  clearBio?: boolean;

  /** Replaces the display name; the username, which signs in, never changes. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName?: string;

  /** Suspends the account until this instant (ISO 8601, in the future). */
  @IsOptional()
  @IsDateString()
  suspendUntil?: string;
}
