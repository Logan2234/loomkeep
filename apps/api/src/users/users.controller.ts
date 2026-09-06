import type {
  AccountDeletionSummaryDto,
  CalendarTokenDto,
  CsvExportDto,
  EntitlementDto,
  SocialProfileDto,
  UserDataExportDto,
  UserDto,
  UsernameAvailabilityDto,
  WidgetTokenDto,
} from "@loomkeep/shared";
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { SocialProfileResponseDto } from "../social/dto/social-profile-response.dto";
import { AccountDeletionSummaryResponseDto } from "./dto/account-deletion-summary-response.dto";
import { CalendarTokenResponseDto } from "./dto/calendar-token-response.dto";
import { ChangeEmailDto } from "./dto/change-email.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ConfirmEmailChangeDto } from "./dto/confirm-email-change.dto";
import { CsvExportResponseDto } from "./dto/csv-export-response.dto";
import { UserDataExportResponseDto } from "./dto/data-export/user-data-export-response.dto";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { EntitlementResponseDto } from "./dto/entitlement-response.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateUsernameDto } from "./dto/update-username.dto";
import { UploadAvatarDto } from "./dto/upload-avatar.dto";
import { UserResponseDto } from "./dto/user-response.dto";
import { UsernameAvailabilityResponseDto } from "./dto/username-availability-response.dto";
import { WidgetTokenResponseDto } from "./dto/widget-token-response.dto";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  @ApiOkResponse({ type: UserResponseDto })
  getMe(@CurrentUser() payload: JwtPayload): Promise<UserDto> {
    return this.users.getMe(payload.sub);
  }

  /**
   * Your own profile. Deliberately served here rather than through
   * `GET /social/users/:username`: that whole controller sits behind
   * `SocialFeatureGuard`, so on a SOCIAL_ENABLED=false instance the profile
   * page — level, XP, streak, per-domain counts, none of them social — had
   * no endpoint at all and rendered as "not found".
   */
  @Get("me/profile")
  @ApiOkResponse({ type: SocialProfileResponseDto })
  getMyProfile(@CurrentUser() payload: JwtPayload): Promise<SocialProfileDto> {
    return this.users.getMyProfile(payload.sub);
  }

  /**
   * Signs a short-lived (5 min) SSO token for Quackback's feedback widget
   * "Verified identity only" mode — the widget trusts this signature
   * instead of asking the visitor to type in their own email. Re-signed on
   * every call rather than cached, since it always expires quickly anyway.
   */
  @Get("me/widget-token")
  @ApiOkResponse({ type: WidgetTokenResponseDto })
  getWidgetToken(@CurrentUser() payload: JwtPayload): Promise<WidgetTokenDto> {
    return this.users.getWidgetToken(payload.sub, payload.email);
  }

  /**
   * Public (no auth) so a plain `<img src>` can load it — the SPA keeps its
   * JWT in localStorage, unreachable from an image request. Cuids are
   * unguessable enough that this doesn't leak anything the id itself doesn't.
   */
  @Public()
  @Get(":id/avatar")
  async getAvatar(
    @Param("id") id: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { avatar, avatarMimeType } = await this.users.getAvatar(id);

    reply
      .header("Cache-Control", "public, max-age=31536000, immutable")
      // helmet is registered app-wide and defaults to
      // `Cross-Origin-Resource-Policy: same-origin`, which blocks this image
      // whenever the web app is served from another origin — the dev setup
      // (:5173 calling :3000) and any deployment where the API is on its own
      // host. Firefox reports it as NS_ERROR_DOM_CORP_FAILED. Relaxed here
      // only: an avatar is a public image, unlike every JSON response.
      .header("Cross-Origin-Resource-Policy", "cross-origin")
      .type(avatarMimeType)
      .send(avatar);
  }

  /** Replaces the account's profile picture. */
  @Patch("me/avatar")
  @ApiOkResponse({ type: UserResponseDto })
  uploadAvatar(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: UploadAvatarDto,
  ): Promise<UserDto> {
    return this.users.uploadAvatar(payload.sub, dto);
  }

  /** Clears the profile picture — the client falls back to the identicon. */
  @Delete("me/avatar")
  @ApiOkResponse({ type: UserResponseDto })
  deleteAvatar(@CurrentUser() payload: JwtPayload): Promise<UserDto> {
    return this.users.deleteAvatar(payload.sub);
  }

  /** Full portable dump of the account's data (GDPR "download my data"). */
  @Get("me/export")
  @ApiOkResponse({ type: UserDataExportResponseDto })
  exportData(@CurrentUser() payload: JwtPayload): Promise<UserDataExportDto> {
    return this.users.exportData(payload.sub);
  }

  /**
   * Flat per-domain CSV, meant for migrating to another tool rather than the
   * GDPR dump above. Deliberately not gated by `enabledDomains` — a domain the
   * user hid from their own nav is still theirs to export.
   */
  @Get("me/export.csv")
  @ApiOkResponse({ type: CsvExportResponseDto })
  exportCsv(
    @CurrentUser() payload: JwtPayload,
    @Query("domain") domainParam: string,
  ): Promise<CsvExportDto> {
    return this.users.exportCsv(payload.sub, domainParam);
  }

  /**
   * Returns the token for the user's public .ics calendar subscription URL,
   * generating one on first call. Stable across calls — use the regenerate
   * endpoint below to revoke a previously shared link. Premium
   * (docs/adr/0001-open-core-agpl.md) — see LibraryService#getCalendarIcs
   * for the matching check on the feed itself.
   */
  @Get("me/calendar-token")
  @ApiOkResponse({ type: CalendarTokenResponseDto })
  getCalendarToken(
    @CurrentUser() payload: JwtPayload,
  ): Promise<CalendarTokenDto> {
    return this.users.getCalendarToken(payload.sub);
  }

  /** Issues a new token, invalidating any previously shared .ics link. Premium. */
  @Post("me/calendar-token/regenerate")
  @ApiCreatedResponse({ type: CalendarTokenResponseDto })
  regenerateCalendarToken(
    @CurrentUser() payload: JwtPayload,
  ): Promise<CalendarTokenDto> {
    return this.users.regenerateCalendarToken(payload.sub);
  }

  /**
   * The user's real plan (not gated by `premium-features` — see
   * `EntitlementService#isEffectivelyPremium`) so the web can decide what to
   * lock: `showLock = flag on && !isPremium`.
   */
  @Get("me/entitlement")
  @ApiOkResponse({ type: EntitlementResponseDto })
  getMyEntitlement(
    @CurrentUser() payload: JwtPayload,
  ): Promise<EntitlementDto> {
    return this.users.getMyEntitlement(payload.sub);
  }

  /** Marks the mandatory first-run onboarding wizard as done. Idempotent. */
  @Post("me/complete-onboarding")
  @ApiCreatedResponse({ type: UserResponseDto })
  completeOnboarding(@CurrentUser() payload: JwtPayload): Promise<UserDto> {
    return this.users.completeOnboarding(payload.sub);
  }

  /**
   * Records re-acceptance of the current CGU (LK-C03) — the blocking
   * app/+layout.svelte prompt shown when acceptedTermsVersion no longer
   * matches LEGAL_VERSION.
   */
  @Post("me/accept-terms")
  @ApiCreatedResponse({ type: UserResponseDto })
  acceptTerms(@CurrentUser() payload: JwtPayload): Promise<UserDto> {
    return this.users.acceptTerms(payload.sub);
  }

  @Patch("me")
  @ApiOkResponse({ type: UserResponseDto })
  updateMe(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: UpdateUserDto,
  ): Promise<UserDto> {
    return this.users.updateMe(payload.sub, dto);
  }

  /**
   * Requires the current password, since email doubles as the login
   * identifier. Doesn't change the email yet — sends a confirmation code to
   * the new address; see confirmEmailChange().
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch("me/email")
  changeEmail(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ChangeEmailDto,
  ): Promise<void> {
    return this.users.changeEmail(payload.sub, dto);
  }

  /** Consumes the code sent by changeEmail() and applies the new address. */
  @Patch("me/email/confirm")
  @ApiOkResponse({ type: UserResponseDto })
  confirmEmailChange(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ConfirmEmailChangeDto,
    @Headers("user-agent") userAgent?: string,
  ): Promise<UserDto> {
    return this.users.confirmEmailChange(payload.sub, dto, userAgent);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch("me/password")
  changePassword(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ChangePasswordDto,
    @Headers("user-agent") userAgent?: string,
  ): Promise<void> {
    return this.users.changePassword(payload.sub, dto, userAgent);
  }

  /**
   * Live preview of what deleting the account would do, for the confirmation
   * modal — every category is always present, even at 0 rows, so the summary
   * reads as exhaustive. Mirrors the `onDelete` behaviour in schema.prisma:
   * most owned rows cascade away, Review/Comment/Report are detached
   * (SetNull) instead since their content is visible to other users.
   */
  @Get("me/deletion-summary")
  @ApiOkResponse({ type: AccountDeletionSummaryResponseDto })
  deletionSummary(
    @CurrentUser() payload: JwtPayload,
  ): Promise<AccountDeletionSummaryDto> {
    return this.users.deletionSummary(payload.sub);
  }

  /**
   * Permanently deletes the account. The current password is re-confirmed since
   * this is irreversible. All owned rows (library entries, watches, refresh
   * tokens, notifications) go with it via `onDelete: Cascade`; Review/Comment/
   * Report are detached (SetNull) instead of deleted — see deletionSummary()
   * above — and the shared MediaItem cache is untouched. A list with editors
   * is the one exception to the cascade: ownership passes to the earliest
   * editor first (see ListService.reassignOwnedListsOnAccountDeletion), so
   * shared work doesn't vanish because one collaborator left.
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("me")
  deleteAccount(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: DeleteAccountDto,
    @Headers("user-agent") userAgent?: string,
  ): Promise<void> {
    return this.users.deleteAccount(payload.sub, dto, userAgent);
  }

  /** Live check backing the debounced availability hint in the username form. */
  @Get("me/username-availability")
  @ApiOkResponse({ type: UsernameAvailabilityResponseDto })
  checkUsernameAvailability(
    @CurrentUser() payload: JwtPayload,
    @Query("value") value?: string,
  ): Promise<UsernameAvailabilityDto> {
    return this.users.checkUsernameAvailability(payload.sub, value);
  }

  /** Re-validates uniqueness server-side — the debounced check is a hint, not the source of truth. */
  @Patch("me/username")
  @ApiOkResponse({ type: UserResponseDto })
  updateUsername(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: UpdateUsernameDto,
  ): Promise<UserDto> {
    return this.users.updateUsername(payload.sub, dto);
  }
}
