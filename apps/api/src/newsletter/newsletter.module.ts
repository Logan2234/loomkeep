import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { AdminNewsletterController } from "./admin-newsletter.controller";
import { NewsletterController } from "./newsletter.controller";
import { NewsletterWebhookController } from "./newsletter-webhook.controller";
import { NewsletterService } from "./newsletter.service";
import { QuackbackWebhookGuard } from "./quackback-webhook.guard";

@Module({
  imports: [MailModule],
  controllers: [
    NewsletterWebhookController,
    AdminNewsletterController,
    NewsletterController,
  ],
  providers: [NewsletterService, QuackbackWebhookGuard],
})
export class NewsletterModule {}
