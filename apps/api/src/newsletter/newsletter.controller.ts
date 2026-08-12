import { Body, Controller, Post } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { UnsubscribeDto } from "./dto/unsubscribe.dto";
import { NewsletterService } from "./newsletter.service";

/** Public endpoint behind the newsletter's one-click "Se désinscrire" link — no login required. */
@Public()
@Controller("newsletter")
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Post("unsubscribe")
  async unsubscribe(@Body() dto: UnsubscribeDto): Promise<void> {
    await this.newsletter.unsubscribe(dto.token);
  }
}
