import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { OneClickUnsubscribeDto } from "./dto/one-click-unsubscribe.dto";
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

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("unsubscribe/one-click")
  async unsubscribeOneClick(
    @Query() query: UnsubscribeDto,
    @Body() _body: OneClickUnsubscribeDto,
  ): Promise<void> {
    await this.newsletter.unsubscribe(query.token);
  }
}
