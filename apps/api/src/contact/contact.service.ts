import { ErrorCode } from "@loomkeep/shared/catalog";
import { HttpStatus, Injectable } from "@nestjs/common";
import { TurnstileService } from "../auth/turnstile.service";
import { AppException } from "../common/app.exception";
import { MailService } from "../mail/mail.service";
import type { AccessibilityReportBody } from "./dto/accessibility-report.dto";

@Injectable()
export class ContactService {
  constructor(
    private readonly mail: MailService,
    private readonly turnstile: TurnstileService,
  ) {}

  async reportAccessibility(
    dto: AccessibilityReportBody,
    ip?: string,
  ): Promise<void> {
    if (!this.mail.canReceiveContact()) {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.ContactUnavailable,
      );
    }

    if (dto.website) return;

    if (!(await this.turnstile.verify(dto.turnstileToken, ip))) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.AuthAntiBotVerificationFailed,
      );
    }

    const sent = await this.mail.sendAccessibilityReport(
      {
        message: dto.message.trim(),
        page: dto.page?.trim() || undefined,
        email: dto.email?.trim() || undefined,
      },
      dto.locale ?? "fr",
    );

    if (!sent) {
      throw new AppException(
        HttpStatus.BAD_GATEWAY,
        ErrorCode.ContactSendFailed,
      );
    }
  }
}
