import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
} from "@nestjs/common";
import { ApiNoContentResponse } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../auth/decorators/public.decorator";
import { ContactService } from "./contact.service";
import { AccessibilityReportBody } from "./dto/accessibility-report.dto";

@Public()
@Controller("contact")
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  // Each report lands in a person's inbox: a few an hour per address is
  // plenty for someone describing a barrier, and caps what a script can send.
  @Throttle({ default: { limit: 3, ttl: 60 * 60 * 1000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @Post("accessibility")
  async accessibility(
    @Body() dto: AccessibilityReportBody,
    @Ip() ip?: string,
  ): Promise<void> {
    await this.contact.reportAccessibility(dto, ip);
  }
}
