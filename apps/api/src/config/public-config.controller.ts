import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { PublicConfigDto } from "@loomkeep/shared";
import { Public } from "../auth/decorators/public.decorator";
import { isSocialEnabled } from "../social/social.config";

// Unauthenticated: the web fetches this once at startup, before login, to know
// which optional surfaces (e.g. social) to render.
@Public()
@Controller("config")
export class PublicConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  get(): PublicConfigDto {
    return { socialEnabled: isSocialEnabled(this.config) };
  }
}
