/** One newsletter send, triggered automatically when a changelog entry is published on Quackback. */
export interface NewsletterSendDto {
  id: string;
  quackbackChangelogId: string;
  title: string;
  recipientCount: number;
  sentAt: string;
}

/** One-click, no-login-required unsubscribe from the release newsletter — token comes from the email footer link. */
export interface UnsubscribeNewsletterRequestDto {
  token: string;
}
