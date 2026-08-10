import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { NewsletterService } from "./newsletter.service";
import { QuackbackWebhookGuard } from "./quackback-webhook.guard";

/**
 * Receives Quackback's "Changelog Published" webhook and triggers the
 * release newsletter — see NewsletterService for the send/idempotency logic.
 * Payload shape isn't documented beyond `{ id, type, createdAt, data }`
 * (Quackback's own webhook docs), so `data` is read defensively: only the
 * fields we need are required, everything else is ignored. The exact shape
 * was inferred from a live Quackback changelog entry (get_details), not from
 * a real webhook delivery — if the first production delivery 400s, the
 * logged body below is the way to find out what actually changed.
 */
@Public()
@UseGuards(QuackbackWebhookGuard)
@Controller("webhook")
export class NewsletterWebhookController {
  private readonly logger = new Logger(NewsletterWebhookController.name);

  constructor(private readonly newsletter: NewsletterService) {}

  @Post("changelog-published")
  @HttpCode(HttpStatus.OK)
  async changelogPublished(@Body() body: unknown): Promise<{ ok: true }> {
    const data = (body as { data?: unknown } | null)?.data as
      Record<string, unknown> | undefined;

    const id = typeof data?.id === "string" ? data.id : null;
    const title = typeof data?.title === "string" ? data.title : null;
    const content = typeof data?.content === "string" ? data.content : null;

    if (!id?.startsWith("changelog_") || !title || !content) {
      this.logger.warn(
        `Unexpected changelog-published payload: ${JSON.stringify(body)}`,
      );
      throw new BadRequestException(
        "Unexpected changelog-published payload shape",
      );
    }

    await this.newsletter.handleChangelogPublished(id, title, content);
    return { ok: true };
  }
}
