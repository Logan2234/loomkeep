export interface NewsletterSendDto {
  id: string;
  quackbackChangelogId: string;
  title: string;
  recipientCount: number;
  sentAt: string;
}

export interface UnsubscribeNewsletterRequestDto {
  token: string;
}
