import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { NewsletterSend } from "@prisma/client";
import type { NewsletterSendDto } from "@loomkeep/shared";
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
    content: string,
  ): Promise<void> {
    const reserved = await this.reserve(quackbackChangelogId, title);
    if (!reserved) return;

    void this.sendAndFinalize(reserved.id, title, content).catch((err) => {
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
    content: string,
  ): Promise<void> {
    const recipients = await this.prisma.user.findMany({
      where: { notifyNewsletter: true },
      select: { email: true },
    });

    await Promise.all(
      recipients.map((r) => this.mail.sendNewsletter(r.email, title, content)),
    );

    await this.prisma.newsletterSend.update({
      where: { id },
      data: { recipientCount: recipients.length },
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
