/** One newsletter send, triggered automatically when a changelog entry is published on Quackback. */
export interface NewsletterSendDto {
  id: string;
  quackbackChangelogId: string;
  title: string;
  recipientCount: number;
  sentAt: string;
}
