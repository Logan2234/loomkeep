import type {
  MailTemplatePreviewDto,
  NewsletterSendDto,
} from "@loomkeep/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminOnly } from "../admin/admin-only.decorator";
import { MailTemplatePreviewResponseDto } from "../admin/dto/mail-template-preview-response.dto";
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

  /** The email one send carried, rendered in `locale` (default fr). */
  @Get(":id/preview")
  @ApiOkResponse({ type: MailTemplatePreviewResponseDto })
  preview(
    @Param("id") id: string,
    @Query("locale") locale = "fr",
  ): Promise<MailTemplatePreviewDto> {
    return this.newsletter.preview(id, locale);
  }
}
