import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ChangelogEntry } from "@prisma/client";
import type { ChangelogEntryDto } from "@loomkeep/shared";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ChangelogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /** Newest first — same order for the public page and the admin table. */
  async list(): Promise<ChangelogEntryDto[]> {
    const entries = await this.prisma.changelogEntry.findMany({
      orderBy: { publishedAt: "desc" },
    });
    return entries.map(toDto);
  }

  async create(input: {
    version: string;
    title: string;
    highlights: string[];
  }): Promise<ChangelogEntryDto> {
    const existing = await this.prisma.changelogEntry.findUnique({
      where: { version: input.version },
    });

    if (existing) {
      throw new ConflictException(
        `Une entrée existe déjà pour la version ${input.version}`,
      );
    }

    const entry = await this.prisma.changelogEntry.create({ data: input });
    return toDto(entry);
  }

  async update(
    id: string,
    input: { version: string; title: string; highlights: string[] },
  ): Promise<ChangelogEntryDto> {
    const other = await this.prisma.changelogEntry.findUnique({
      where: { version: input.version },
    });

    if (other && other.id !== id) {
      throw new ConflictException(
        `Une entrée existe déjà pour la version ${input.version}`,
      );
    }

    try {
      const entry = await this.prisma.changelogEntry.update({
        where: { id },
        data: input,
      });
      return toDto(entry);
    } catch {
      throw new NotFoundException("Changelog entry not found");
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.changelogEntry.delete({ where: { id } });
    } catch {
      throw new NotFoundException("Changelog entry not found");
    }
  }

  /**
   * Sends the release newsletter for one entry to every opted-in account.
   * Resendable on purpose (see the model comment on `emailSentAt`) — an
   * admin fixing a typo or recovering from an SMTP outage can trigger it
   * again; nothing here is deduped beyond "one send per button click".
   */
  async send(
    id: string,
  ): Promise<{ recipientCount: number; emailSentAt: Date }> {
    const entry = await this.prisma.changelogEntry.findUnique({
      where: { id },
    });
    if (!entry) throw new NotFoundException("Changelog entry not found");

    const recipients = await this.prisma.user.findMany({
      where: { notifyNewsletter: true },
      select: { email: true },
    });

    await Promise.all(
      recipients.map((r) =>
        this.mail.sendNewsletter(
          r.email,
          entry.version,
          entry.title,
          entry.highlights,
        ),
      ),
    );

    const emailSentAt = new Date();
    await this.prisma.changelogEntry.update({
      where: { id },
      data: { emailSentAt },
    });

    return { recipientCount: recipients.length, emailSentAt };
  }
}

function toDto(entry: ChangelogEntry): ChangelogEntryDto {
  return {
    id: entry.id,
    version: entry.version,
    title: entry.title,
    highlights: entry.highlights,
    publishedAt: entry.publishedAt.toISOString(),
    emailSentAt: entry.emailSentAt?.toISOString() ?? null,
  };
}
