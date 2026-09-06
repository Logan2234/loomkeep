import { ErrorCode, type NewsletterSendDto } from "@loomkeep/shared";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import type { NewsletterSend } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { AppException } from "../common/app.exception";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";

const QUACKBACK_CHANGELOG_API_URL =
  "https://feedback.loomkeep.app/api/v1/changelog";

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
      quackbackChangelogId,
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
    quackbackChangelogId: string,
    title: string,
    contentPreview: string,
    contentHtml: string,
  ): Promise<void> {
    const content = await this.resolveContent(
      quackbackChangelogId,
      contentPreview,
      contentHtml,
    );
    const recipients = await this.prisma.user.findMany({
      where: { notifyNewsletter: true },
      select: {
        id: true,
        email: true,
        locale: true,
        newsletterUnsubscribeToken: true,
      },
    });

    await Promise.all(
      recipients.map(async (r) => {
        const token = await this.getOrCreateUnsubscribeToken(
          r.id,
          r.newsletterUnsubscribeToken,
        );
        await this.mail.sendNewsletter(
          { email: r.email, locale: r.locale },
          title,
          content.preview,
          content.html,
          token,
        );
      }),
    );

    await this.prisma.newsletterSend.update({
      where: { id },
      data: { recipientCount: recipients.length },
    });
  }

  private async resolveContent(
    changelogId: string,
    contentPreview: string,
    contentHtml: string,
  ): Promise<{ preview: string; html: string }> {
    if (contentHtml) {
      return { preview: contentPreview, html: contentHtml };
    }

    const apiKey = process.env.QUACKBACK_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        `Quackback did not include the full content for ${changelogId}, and QUACKBACK_API_KEY is not configured`,
      );
      return { preview: contentPreview, html: contentHtml };
    }

    try {
      const response = await fetch(
        `${QUACKBACK_CHANGELOG_API_URL}/${encodeURIComponent(changelogId)}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      if (!response.ok) {
        throw new Error(`Quackback returned HTTP ${response.status}`);
      }

      const payload: unknown = await response.json();
      const content = (payload as { data?: { content?: unknown } }).data
        ?.content;
      if (typeof content !== "string" || !content) {
        throw new Error("Quackback returned no changelog content");
      }

      return { preview: content, html: contentHtml };
    } catch (err) {
      this.logger.warn(
        `Could not load the complete Quackback changelog ${changelogId}: ${err instanceof Error ? err.message : "unknown error"}`,
      );
      return { preview: contentPreview, html: contentHtml };
    }
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
