import type { ShowcaseDto } from "@loomkeep/shared";
import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { ShowcaseResponseDto } from "./showcase-response.dto";
import { ShowcaseService } from "./showcase.service";

@Controller("showcase")
export class ShowcaseController {
  constructor(private readonly showcase: ShowcaseService) {}

  /** Covers for the sign-in page's backdrop, before anyone is signed in. */
  @Public()
  @Get()
  @ApiOkResponse({ type: ShowcaseResponseDto })
  get(): Promise<ShowcaseDto> {
    return this.showcase.get();
  }
}
