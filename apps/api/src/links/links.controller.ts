import type { ResolveLinkResultDto } from "@loomkeep/shared";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { ResolveLinkResultResponseDto } from "./dto/resolve-link-response.dto";
import { LinkResolverService } from "./link-resolver.service";

@Controller("links")
export class LinksController {
  constructor(private readonly resolver: LinkResolverService) {}

  /** The Loomkeep page behind a TMDB/IMDb/Steam/… link, for the share target. */
  @Get("resolve")
  @ApiOkResponse({ type: ResolveLinkResultResponseDto })
  async resolve(@Query("url") url = ""): Promise<ResolveLinkResultDto> {
    return { match: await this.resolver.resolve(url) };
  }
}
