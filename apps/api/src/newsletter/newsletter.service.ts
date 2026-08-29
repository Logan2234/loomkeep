import { ErrorCode, type NewsletterSendDto } from "@loomkeep/shared";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import type { NewsletterSend } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { AppException } from "../common/app.exception";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Send history for the admin page, newest first. */
  async list(): Promise<NewsletterSendDto[]> {
    const sends = await this.prisma.newsletterSend.findMany({
      orderBy: { sentAt: "desc" },
    });
    return sends.map(toDto);
  }

  /**
   * Reserves the send (idempotent — a retried webhook delivery for the same
   * Quackback entry is a no-op) then fires the emails without awaiting them,
   * so the webhook controller can respond within Quackback's 5s timeout.
   * Errors from the send itself are only logged; there's no request left to
   * fail by that point.
   */
  async handleChangelogPublished(
    quackbackChangelogId: string,
    title: string,
    contentPreview: string,
    contentHtml: string,
  ): Promise<void> {
    const reserved = await this.reserve(quackbackChangelogId, title);
    if (!reserved) return;

    void this.sendAndFinalize(
      reserved.id,
      title,
      contentPreview,
      contentHtml,
    ).catch((err) => {
      this.logger.error(
        `Newsletter send failed for changelog ${quackbackChangelogId}`,
        err,
      );
    });
  }

  private async reserve(
    quackbackChangelogId: string,
    title: string,
  ): Promise<NewsletterSend | null> {
    try {
      return await this.prisma.newsletterSend.create({
        data: { quackbackChangelogId, title },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return null;
      }

      throw err;
    }
  }

  private async sendAndFinalize(
    id: string,
    title: string,
    contentPreview: string,
    contentHtml: string,
  ): Promise<void> {
    const recipients = await this.prisma.user.findMany({
      where: { notifyNewsletter: true },
      select: { id: true, email: true, newsletterUnsubscribeToken: true },
    });

    await Promise.all(
      recipients.map(async (r) => {
        const token = await this.getOrCreateUnsubscribeToken(
          r.id,
          r.newsletterUnsubscribeToken,
        );
        await this.mail.sendNewsletter(
          r.email,
          title,
          contentPreview,
          contentHtml,
          token,
        );
      }),
    );

    await this.prisma.newsletterSend.update({
      where: { id },
      data: { recipientCount: recipients.length },
    });
  }

  /**
   * Stable per-user unsubscribe token, generated once and reused in every
   * newsletter this account ever receives — not one token per send, which
   * would grow the table without bound as the newsletter goes out
   * repeatedly (see User.newsletterUnsubscribeToken doc comment).
   */
  private async getOrCreateUnsubscribeToken(
    userId: string,
    existing: string | null,
  ): Promise<string> {
    if (existing) return existing;

    const token = randomBytes(32).toString("hex");
    await this.prisma.user.update({
      where: { id: userId },
      data: { newsletterUnsubscribeToken: token },
    });
    return token;
  }

  /** Consumes a one-click unsubscribe link from a newsletter email footer — no login required. */
  async unsubscribe(token: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { newsletterUnsubscribeToken: token },
    });

    if (!user) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.NewsletterInvalidUnsubscribeLink,
        undefined,
        "Invalid unsubscribe link",
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { notifyNewsletter: false },
    });
  }
}

function toDto(entry: NewsletterSend): NewsletterSendDto {
  return {
    id: entry.id,
    quackbackChangelogId: entry.quackbackChangelogId,
    title: entry.title,
    recipientCount: entry.recipientCount,
    sentAt: entry.sentAt.toISOString(),
  };
}
