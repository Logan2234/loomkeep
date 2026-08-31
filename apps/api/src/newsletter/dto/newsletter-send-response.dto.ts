import type { NewsletterSendDto } from "@loomkeep/shared";

export class NewsletterSendResponseDto implements NewsletterSendDto {
  id!: string;
  quackbackChangelogId!: string;
  title!: string;
  recipientCount!: number;
  sentAt!: string;
}
