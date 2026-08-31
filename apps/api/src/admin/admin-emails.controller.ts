import {
  ErrorCode,
  type MailTemplateListResponseDto,
  type MailTemplatePreviewDto,
} from "@loomkeep/shared";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AppException } from "../common/app.exception";
import { MailService } from "../mail/mail.service";
import { AdminOnly } from "./admin-only.decorator";
import { MailTemplateListResponseResponseDto } from "./dto/mail-template-list-response.dto";
import { MailTemplatePreviewResponseDto } from "./dto/mail-template-preview-response.dto";
import { SendTestEmailDto } from "./dto/send-test-email.dto";

/** Transactional email gallery: template listing, preview and test-send. */
@AdminOnly()
@Controller("admin")
export class AdminEmailsController {
  constructor(private readonly mail: MailService) {}

  /** Every template available in the email gallery. */
  @Get("emails")
  @ApiOkResponse({ type: MailTemplateListResponseResponseDto })
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
  @ApiOkResponse({ type: MailTemplatePreviewResponseDto })
  previewEmailTemplate(
    @Param("key") key: string,
    @Query() overrides: Record<string, string>,
  ): MailTemplatePreviewDto {
    const preview = this.mail.renderTemplatePreview(key, overrides);
    if (!preview)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.AdminEmailTemplateNotFound,
      );
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
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.AdminSmtpNotConfigured,
      );
    }

    const sent = await this.mail.sendTemplateTest(key, dto.to, dto.values);
    if (!sent)
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.AdminEmailTemplateNotFound,
      );
  }
}
