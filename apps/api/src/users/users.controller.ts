import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Query,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { User } from "@prisma/client";
import {
  Domain,
  type CsvExportDto,
  type UserDataExportDto,
  type UserDto,
  type UsernameAvailabilityDto,
} from "@loomkeep/shared";
import * as bcrypt from "bcryptjs";
import type { FastifyReply } from "fastify";
import { randomInt } from "node:crypto";
import { BCRYPT_ROUNDS, hashToken, toUserDto } from "../auth/auth.service";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { parseEnumParam } from "../common/parse-enum-param.util";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { SecurityEventService } from "../security/security-event.service";
import { isAdult } from "./age.util";
import { matchesMimeType } from "./avatar.util";
import { CsvExportService } from "./csv-export.service";
import { DataExportService } from "./data-export.service";
import { ChangeEmailDto } from "./dto/change-email.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ConfirmEmailChangeDto } from "./dto/confirm-email-change.dto";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateUsernameDto } from "./dto/update-username.dto";
import { UploadAvatarDto } from "./dto/upload-avatar.dto";

// Decoded byte ceiling for an uploaded avatar — base64 for this is checked by
// UploadAvatarDto's MaxLength, this is the belt-and-suspenders check on the
// actual decoded buffer.
const MAX_AVATAR_BYTES = 2.5 * 1024 * 1024;

const EMAIL_CHANGE_TTL_MINUTES = 15;
const MAX_EMAIL_CHANGE_ATTEMPTS = 5;

@Controller("users")
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly security: SecurityEventService,
    private readonly dataExport: DataExportService,
    private readonly csvExport: CsvExportService,
  ) {}

  @Get("me")
  async getMe(@CurrentUser() payload: JwtPayload): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return toUserDto(user);
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
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { avatar: true, avatarMimeType: true },
    });

    if (!user?.avatar || !user.avatarMimeType) {
      throw new NotFoundException();
    }

    reply
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .type(user.avatarMimeType)
      .send(user.avatar);
  }

  /** Replaces the account's profile picture. */
  @Patch("me/avatar")
  async uploadAvatar(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: UploadAvatarDto,
  ): Promise<UserDto> {
    const buffer = Buffer.from(dto.data, "base64");

    if (buffer.length === 0 || buffer.length > MAX_AVATAR_BYTES) {
      throw new BadRequestException("Image trop volumineuse");
    }

    if (!matchesMimeType(buffer, dto.mimeType)) {
      throw new BadRequestException(
        "Le fichier ne correspond pas au type d'image déclaré",
      );
    }

    const user = await this.prisma.user.update({
      where: { id: payload.sub },
      data: {
        avatar: buffer,
        avatarMimeType: dto.mimeType,
        avatarUpdatedAt: new Date(),
      },
    });
    return toUserDto(user);
  }

  /** Clears the profile picture — the client falls back to the identicon. */
  @Delete("me/avatar")
  async deleteAvatar(@CurrentUser() payload: JwtPayload): Promise<UserDto> {
    const user = await this.prisma.user.update({
      where: { id: payload.sub },
      data: { avatar: null, avatarMimeType: null, avatarUpdatedAt: null },
    });
    return toUserDto(user);
  }

  /** Full portable dump of the account's data (GDPR "download my data"). */
  @Get("me/export")
  exportData(@CurrentUser() payload: JwtPayload): Promise<UserDataExportDto> {
    return this.dataExport.buildExport(payload.sub);
  }

  /**
   * Flat per-domain CSV, meant for migrating to another tool rather than the
   * GDPR dump above. Deliberately not gated by `enabledDomains` — a domain the
   * user hid from their own nav is still theirs to export.
   */
  @Get("me/export.csv")
  async exportCsv(
    @CurrentUser() payload: JwtPayload,
    @Query("domain") domainParam: string,
  ): Promise<CsvExportDto> {
    const domain = parseEnumParam(domainParam, Object.values(Domain), "domain");
    return { csv: await this.csvExport.buildCsv(payload.sub, domain) };
  }

  @Patch("me")
  async updateMe(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: UpdateUserDto,
  ): Promise<UserDto> {
    if (dto.birthDate && new Date(dto.birthDate) > new Date()) {
      throw new BadRequestException("Birth date cannot be in the future");
    }

    const current = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { birthDate: true, allowAdultContent: true },
    });

    if (!current) {
      throw new NotFoundException("User not found");
    }

    const nextBirthDate =
      dto.birthDate === undefined
        ? current.birthDate
        : dto.birthDate === null
          ? null
          : new Date(dto.birthDate);

    let nextAllowAdultContent =
      dto.allowAdultContent ?? current.allowAdultContent;

    if (nextAllowAdultContent && !isAdult(nextBirthDate)) {
      if (dto.allowAdultContent === true) {
        throw new BadRequestException(
          "Adult content requires a birth date confirming the account is 18+",
        );
      }

      // The birth date changed under a previously-enabled flag: turn it off quietly.
      nextAllowAdultContent = false;
    }

    // The "menu" launcher must always be reachable from the bottom bar.
    if (dto.mobileNavShortcuts && !dto.mobileNavShortcuts.includes("menu")) {
      throw new BadRequestException(
        'mobileNavShortcuts must include the "menu" launcher',
      );
    }

    const user = await this.prisma.user.update({
      where: { id: payload.sub },
      data: {
        displayName: dto.displayName,
        birthDate: nextBirthDate,
        allowAdultContent: nextAllowAdultContent,
        notifyEmail: dto.notifyEmail,
        notifyPush: dto.notifyPush,
        enabledDomains: dto.enabledDomains,
        mobileNavShortcuts: dto.mobileNavShortcuts,
        // Empty string clears the bio back to null.
        bio: dto.bio === undefined ? undefined : dto.bio || null,
        defaultReviewVisibility: dto.defaultReviewVisibility,
        defaultListVisibility: dto.defaultListVisibility,
      },
    });
    return toUserDto(user);
  }

  /**
   * Requires the current password, since email doubles as the login
   * identifier. Doesn't change the email yet — sends a confirmation code to
   * the new address; see confirmEmailChange().
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch("me/email")
  async changeEmail(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ChangeEmailDto,
  ): Promise<void> {
    await this.requireVerifiedUser(payload.sub, dto.currentPassword);

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.newEmail },
      select: { id: true },
    });

    if (existing && existing.id !== payload.sub) {
      throw new ConflictException("An account with this email already exists");
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await this.prisma.$transaction([
      this.prisma.emailChangeRequest.deleteMany({
        where: { userId: payload.sub },
      }),
      this.prisma.emailChangeRequest.create({
        data: {
          userId: payload.sub,
          newEmail: dto.newEmail,
          codeHash: hashToken(code),
          expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MINUTES * 60_000),
        },
      }),
    ]);
    await this.mail.sendEmailChangeCode(dto.newEmail, code);
  }

  /** Consumes the code sent by changeEmail() and applies the new address. */
  @Patch("me/email/confirm")
  async confirmEmailChange(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ConfirmEmailChangeDto,
    @Headers("user-agent") userAgent?: string,
  ): Promise<UserDto> {
    const current = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!current) {
      throw new NotFoundException("User not found");
    }

    const stored = await this.prisma.emailChangeRequest.findFirst({
      where: { userId: payload.sub },
    });

    const matches =
      stored &&
      stored.codeHash === hashToken(dto.code) &&
      stored.expiresAt >= new Date();

    if (!stored || !matches) {
      if (stored) {
        if (stored.attempts + 1 >= MAX_EMAIL_CHANGE_ATTEMPTS) {
          await this.prisma.emailChangeRequest.deleteMany({
            where: { userId: payload.sub },
          });
        } else {
          await this.prisma.emailChangeRequest.update({
            where: { id: stored.id },
            data: { attempts: { increment: 1 } },
          });
        }
      }

      throw new UnauthorizedException("Invalid or expired code");
    }

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: payload.sub },
        data: { email: stored.newEmail },
      }),
      this.prisma.emailChangeRequest.deleteMany({
        where: { userId: payload.sub },
      }),
    ]);
    await this.mail.sendEmailChanged(current.email, stored.newEmail);
    await this.security.record({
      type: "EMAIL_CHANGED",
      userId: payload.sub,
      identifier: stored.newEmail,
      detail: `${current.email} → ${stored.newEmail}`,
      userAgent,
    });
    return toUserDto(user);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch("me/password")
  async changePassword(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ChangePasswordDto,
    @Headers("user-agent") userAgent?: string,
  ): Promise<void> {
    const current = await this.requireVerifiedUser(
      payload.sub,
      dto.currentPassword,
    );

    if (await bcrypt.compare(dto.newPassword, current.passwordHash)) {
      throw new BadRequestException(
        "New password must be different from the current password",
      );
    }

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    });
    await this.mail.sendPasswordChanged(current.email);
    await this.security.record({
      type: "PASSWORD_CHANGED",
      userId: payload.sub,
      identifier: current.email,
      userAgent,
    });
  }

  /**
   * Permanently deletes the account. The current password is re-confirmed since
   * this is irreversible. All owned rows (library entries, watches, refresh
   * tokens, notifications) go with it via `onDelete: Cascade`; the shared
   * MediaItem cache is untouched.
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("me")
  async deleteAccount(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: DeleteAccountDto,
    @Headers("user-agent") userAgent?: string,
  ): Promise<void> {
    const current = await this.requireVerifiedUser(
      payload.sub,
      dto.currentPassword,
    );

    // Recorded before the delete so the FK (onDelete: SetNull) still resolves;
    // the row itself survives the account's removal.
    await this.security.record({
      type: "USER_DELETED",
      userId: payload.sub,
      identifier: current.email,
      userAgent,
    });
    await this.prisma.user.delete({ where: { id: payload.sub } });
  }

  /** Live check backing the debounced availability hint in the username form. */
  @Get("me/username-availability")
  async checkUsernameAvailability(
    @CurrentUser() payload: JwtPayload,
    @Query("value") value?: string,
  ): Promise<UsernameAvailabilityDto> {
    if (!value) {
      return { available: false };
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: value },
      select: { id: true },
    });
    return { available: !existing || existing.id === payload.sub };
  }

  /** Re-validates uniqueness server-side — the debounced check is a hint, not the source of truth. */
  @Patch("me/username")
  async updateUsername(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: UpdateUsernameDto,
  ): Promise<UserDto> {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
      select: { id: true },
    });

    if (existing && existing.id !== payload.sub) {
      throw new ConflictException("This username is already taken");
    }

    const user = await this.prisma.user.update({
      where: { id: payload.sub },
      data: { username: dto.username },
    });
    return toUserDto(user);
  }

  /**
   * Loads the account and re-confirms its password — the shared guard for the
   * sensitive self-service actions (email/password change, deletion), where
   * the current password is required since email doubles as the login id.
   */
  private async requireVerifiedUser(
    userId: string,
    currentPassword: string,
  ): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    return user;
  }
}
