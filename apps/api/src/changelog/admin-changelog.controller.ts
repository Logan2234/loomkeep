import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import type {
  ChangelogEntryDto,
  SendChangelogNewsletterResponseDto,
} from "@loomkeep/shared";
import { AdminOnly } from "../admin/admin-only.decorator";
import { ChangelogService } from "./changelog.service";
import { ChangelogEntryDto as ChangelogEntryBody } from "./dto/changelog-entry.dto";

/** Admin management of user-facing release notes — see ChangelogService for the send semantics. */
@AdminOnly()
@Controller("admin/changelog")
export class AdminChangelogController {
  constructor(private readonly changelog: ChangelogService) {}

  @Get()
  list(): Promise<ChangelogEntryDto[]> {
    return this.changelog.list();
  }

  @Post()
  create(@Body() body: ChangelogEntryBody): Promise<ChangelogEntryDto> {
    return this.changelog.create(body);
  }

  @Put(":id")
  update(
    @Param("id") id: string,
    @Body() body: ChangelogEntryBody,
  ): Promise<ChangelogEntryDto> {
    return this.changelog.update(id, body);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(":id")
  async delete(@Param("id") id: string): Promise<void> {
    await this.changelog.delete(id);
  }

  /** Sends (or resends) the release newsletter for this entry to every opted-in account. */
  @Post(":id/send")
  async send(
    @Param("id") id: string,
  ): Promise<SendChangelogNewsletterResponseDto> {
    const { recipientCount, emailSentAt } = await this.changelog.send(id);
    return { recipientCount, emailSentAt: emailSentAt.toISOString() };
  }
}
