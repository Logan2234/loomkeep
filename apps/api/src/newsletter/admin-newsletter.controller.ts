import { Controller, Get } from "@nestjs/common";
import type { NewsletterSendDto } from "@loomkeep/shared";
import { AdminOnly } from "../admin/admin-only.decorator";
import { NewsletterService } from "./newsletter.service";

/** Read-only send history — sending itself is fully automatic (see NewsletterWebhookController). */
@AdminOnly()
@Controller("admin/newsletter")
export class AdminNewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Get()
  list(): Promise<NewsletterSendDto[]> {
    return this.newsletter.list();
  }
}
