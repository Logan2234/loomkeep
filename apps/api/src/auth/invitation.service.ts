import type {
  AdminInvitationDto,
  AdminInvitationLinkDto,
  AdminInvitationStatus,
  InvitationPreviewDto,
  PagedResult,
} from "@loomkeep/shared";
import { ErrorCode } from "@loomkeep/shared";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron } from "@nestjs/schedule";
import type { Invitation, Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { AppException } from "../common/app.exception";
import type { ParsedPage } from "../common/pagination.util";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { avatarUrl } from "../users/avatar.util";

/** How long an unused, dead (expired or revoked) invitation is kept for the admin list. */
const DEAD_INVITATION_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60_000;

const INVITATION_INCLUDE = {
  createdBy: { select: { displayName: true } },
  redeemedBy: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUpdatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.InvitationInclude;

type InvitationWithRelations = Prisma.InvitationGetPayload<{
  include: typeof INVITATION_INCLUDE;
}>;

export interface CreateInvitationInput {
  email?: string;
  label?: string;
  maxUses: number;
  validityDays: number;
}

function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function invitationStatus(
  invitation: Pick<
    Invitation,
    "revokedAt" | "useCount" | "maxUses" | "expiresAt"
  >,
  now = new Date(),
): AdminInvitationStatus {
  if (invitation.revokedAt) return "revoked";
  if (invitation.useCount >= invitation.maxUses) return "used";
  if (invitation.expiresAt <= now) return "expired";
  return "pending";
}

/**
 * Sign-up invitations (ADM-01): minted from the admin users screen, redeemed
 * by AuthService.register(). An invitation bypasses REGISTRATION_ENABLED —
 * a closed instance stays reachable by invitation only.
 */
@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);
  private readonly webOrigin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    config: ConfigService,
  ) {
    // WEB_ORIGIN may list several origins (see main.ts's CORS setup); links
    // point at the first, like every other link the API hands out.
    this.webOrigin =
      (config.get<string>("WEB_ORIGIN") ?? "")
        .split(",")[0]
        ?.trim()
        .replace(/\/$/, "") || "http://localhost:5173";
  }

  async list(page: ParsedPage): Promise<PagedResult<AdminInvitationDto>> {
    const rows = await this.prisma.invitation.findMany({
      include: INVITATION_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: page.skip,
      take: page.take + 1,
    });
    const now = new Date();

    return {
      items: rows.slice(0, page.limit).map((row) => this.toDto(row, now)),
      hasMore: rows.length > page.limit,
    };
  }

  async create(
    creatorId: string,
    input: CreateInvitationInput,
  ): Promise<AdminInvitationLinkDto> {
    const email = input.email || null;

    if (email) {
      await this.assertEmailInvitable(email);
    }

    const token = randomBytes(32).toString("hex");
    const now = new Date();
    const invitation = await this.prisma.invitation.create({
      data: {
        tokenHash: hashInvitationToken(token),
        createdById: creatorId,
        email,
        label: input.label?.trim() || null,
        // An address-bound invitation can only ever create that one account.
        maxUses: email ? 1 : input.maxUses,
        tokenIssuedAt: now,
        expiresAt: new Date(now.getTime() + input.validityDays * DAY_MS),
      },
      include: INVITATION_INCLUDE,
    });

    return this.deliver(creatorId, invitation, token);
  }

  /**
   * Mints a fresh link for a still-open invitation (pending or expired, never
   * revoked or used up): the old link stops working, the validity restarts
   * with its original length, and a bound address gets the new link mailed.
   */
  async renew(
    creatorId: string,
    invitationId: string,
  ): Promise<AdminInvitationLinkDto> {
    const existing = await this.findOrThrow(invitationId);
    const status = invitationStatus(existing);

    if (status === "revoked" || status === "used") {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.AdminInvitationNotRenewable,
      );
    }

    if (existing.email) {
      await this.assertEmailRegistrable(existing.email);
    }

    const token = randomBytes(32).toString("hex");
    const now = new Date();
    const validityMs =
      existing.expiresAt.getTime() - existing.tokenIssuedAt.getTime();
    const invitation = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: {
        tokenHash: hashInvitationToken(token),
        tokenIssuedAt: now,
        expiresAt: new Date(now.getTime() + validityMs),
      },
      include: INVITATION_INCLUDE,
    });

    return this.deliver(creatorId, invitation, token);
  }

  async revoke(invitationId: string): Promise<AdminInvitationDto> {
    const existing = await this.findOrThrow(invitationId);

    if (existing.revokedAt) return this.toDto(existing);

    const invitation = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { revokedAt: new Date() },
      include: INVITATION_INCLUDE,
    });
    return this.toDto(invitation);
  }

  /** The sign-up page's view of a link — throws when it can't be redeemed. */
  async preview(token: string): Promise<InvitationPreviewDto> {
    const invitation = await this.findRedeemable(token);

    return {
      inviterName: invitation.createdBy?.displayName ?? null,
      email: invitation.email,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  /**
   * Looks up a redeemable invitation for `email` — the pre-flight check of
   * AuthService.register(). Does not consume it: claim() does, inside the
   * account-creation transaction.
   */
  async findRedeemableFor(token: string, email: string): Promise<Invitation> {
    const invitation = await this.findRedeemable(token);

    if (invitation.email && invitation.email !== email) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AuthInvitationEmailMismatch,
      );
    }

    return invitation;
  }

  /**
   * Takes one place on the invitation, atomically: the conditional update
   * only matches while the invitation is still open, so two sign-ups racing
   * on a last place can't both get through — the loser's transaction (and
   * its freshly created account) rolls back.
   */
  async claim(
    tx: Prisma.TransactionClient,
    invitationId: string,
  ): Promise<void> {
    const { count } = await tx.invitation.updateMany({
      where: {
        id: invitationId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        useCount: { lt: tx.invitation.fields.maxUses },
      },
      data: { useCount: { increment: 1 } },
    });

    if (count === 0) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AuthInvalidInvitation,
      );
    }
  }

  /**
   * Drops dead invitations nobody ever used, once they've lingered long
   * enough in the admin list. A redeemed one is kept: it's what the admin
   * drawer's "invité par" line reads.
   */
  @Cron("30 6 * * *")
  async purgeDead(now = new Date()): Promise<void> {
    const before = new Date(
      now.getTime() - DEAD_INVITATION_RETENTION_DAYS * DAY_MS,
    );
    const { count } = await this.prisma.invitation.deleteMany({
      where: {
        useCount: 0,
        OR: [{ expiresAt: { lt: before } }, { revokedAt: { lt: before } }],
      },
    });

    if (count > 0) this.logger.log(`Purged ${count} dead invitations`);
  }

  private async findRedeemable(
    token: string,
  ): Promise<Invitation & { createdBy: { displayName: string } | null }> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      include: { createdBy: { select: { displayName: true } } },
    });
    const status = invitation ? invitationStatus(invitation) : null;

    if (status === "expired") {
      throw new AppException(HttpStatus.GONE, ErrorCode.AuthInvitationExpired);
    }

    // Unknown, revoked and used up all read the same from outside: nothing
    // to learn about which links exist.
    if (!invitation || status !== "pending") {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.AuthInvalidInvitation,
      );
    }

    return invitation;
  }

  private async findOrThrow(id: string): Promise<InvitationWithRelations> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id },
      include: INVITATION_INCLUDE,
    });

    if (!invitation) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.AdminInvitationNotFound,
      );
    }

    return invitation;
  }

  /** An address can't be invited twice at once, nor once it has an account. */
  private async assertEmailInvitable(email: string): Promise<void> {
    await this.assertEmailRegistrable(email);

    const pending = await this.prisma.invitation.findFirst({
      where: {
        email,
        revokedAt: null,
        useCount: 0,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (pending) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.AdminInvitationAlreadyPending,
      );
    }
  }

  private async assertEmailRegistrable(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (user) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.AdminInvitationEmailRegistered,
      );
    }
  }

  /** Mails the link when there's an address and SMTP to send it with. */
  private async deliver(
    creatorId: string,
    invitation: InvitationWithRelations,
    token: string,
  ): Promise<AdminInvitationLinkDto> {
    const url = `${this.webOrigin}/register?invite=${token}`;
    let emailed = false;

    if (invitation.email && this.mail.isConfigured()) {
      const creator = await this.prisma.user.findUnique({
        where: { id: creatorId },
        select: { displayName: true, locale: true },
      });
      // The invitee has no locale yet: the inviter's is the best guess.
      await this.mail.sendInvitation(
        { email: invitation.email, locale: creator?.locale ?? "fr" },
        creator?.displayName ?? null,
        url,
        invitation.expiresAt,
      );
      invitation = await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { emailedAt: new Date() },
        include: INVITATION_INCLUDE,
      });
      emailed = true;
    }

    return { invitation: this.toDto(invitation), url, emailed };
  }

  private toDto(
    invitation: InvitationWithRelations,
    now = new Date(),
  ): AdminInvitationDto {
    return {
      id: invitation.id,
      email: invitation.email,
      label: invitation.label,
      maxUses: invitation.maxUses,
      useCount: invitation.useCount,
      status: invitationStatus(invitation, now),
      expiresAt: invitation.expiresAt.toISOString(),
      revokedAt: invitation.revokedAt?.toISOString() ?? null,
      emailedAt: invitation.emailedAt?.toISOString() ?? null,
      createdAt: invitation.createdAt.toISOString(),
      createdByName: invitation.createdBy?.displayName ?? null,
      redeemedBy: invitation.redeemedBy.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: avatarUrl(user),
      })),
    };
  }
}
