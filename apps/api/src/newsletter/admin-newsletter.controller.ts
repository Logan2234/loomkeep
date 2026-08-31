import type { NewsletterSendDto } from "@loomkeep/shared";
import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminOnly } from "../admin/admin-only.decorator";
import { NewsletterSendResponseDto } from "./dto/newsletter-send-response.dto";
import { NewsletterService } from "./newsletter.service";

/** Read-only send history — sending itself is fully automatic (see NewsletterWebhookController). */
@AdminOnly()
@Controller("admin/newsletter")
export class AdminNewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Get()
  @ApiOkResponse({ type: NewsletterSendResponseDto, isArray: true })
  list(): Promise<NewsletterSendDto[]> {
    return this.newsletter.list();
  }
}
