import { Controller, Get } from "@nestjs/common";
import type { ChangelogEntryDto } from "@loomkeep/shared";
import { Public } from "../auth/decorators/public.decorator";
import { ChangelogService } from "./changelog.service";

/** Public release notes — no auth, linked from the version footer and the newsletter email. */
@Public()
@Controller("changelog")
export class ChangelogController {
  constructor(private readonly changelog: ChangelogService) {}

  @Get()
  list(): Promise<ChangelogEntryDto[]> {
    return this.changelog.list();
  }
}
