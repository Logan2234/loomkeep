import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
} from "@nestjs/common";
import type {
  MailTemplateListResponseDto,
  MailTemplatePreviewDto,
} from "@loomkeep/shared";
import { MailService } from "../mail/mail.service";
import { AdminOnly } from "./admin-only.decorator";
import { SendTestEmailDto } from "./dto/send-test-email.dto";

/** Transactional email gallery: template listing, preview and test-send. */
@AdminOnly()
@Controller("admin")
export class AdminEmailsController {
  constructor(private readonly mail: MailService) {}

  /** Every template available in the email gallery. */
  @Get("emails")
  listEmailTemplates(): MailTemplateListResponseDto {
    return {
      templates: this.mail.listTemplates(),
      smtpConfigured: this.mail.isConfigured(),
    };
  }

  /**
   * Renders one template with its sample data — nothing is sent. Query
   * params matching a field key (see `listEmailTemplates`) override that
   * field's default, e.g. `?displayName=A+very+long+name…`.
   */
  @Get("emails/:key/preview")
  previewEmailTemplate(
    @Param("key") key: string,
    @Query() overrides: Record<string, string>,
  ): MailTemplatePreviewDto {
    const preview = this.mail.renderTemplatePreview(key, overrides);
    if (!preview) throw new NotFoundException("Unknown template");
    return preview;
  }

  /** Sends one template, rendered with the same (possibly overridden) sample data as the preview, to a chosen address. */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("emails/:key/test")
  async sendTestEmail(
    @Param("key") key: string,
    @Body() dto: SendTestEmailDto,
  ): Promise<void> {
    if (!this.mail.isConfigured()) {
      throw new ServiceUnavailableException("SMTP is not configured");
    }

    const sent = await this.mail.sendTemplateTest(key, dto.to, dto.values);
    if (!sent) throw new NotFoundException("Unknown template");
  }
}
