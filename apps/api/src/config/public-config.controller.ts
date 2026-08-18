import type { PublicConfigDto } from "@loomkeep/shared";
import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Public } from "../auth/decorators/public.decorator";
import { isRegistrationEnabled } from "../auth/registration.config";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { isSocialEnabled } from "../social/social.config";

// which optional surfaces (e.g. social) to render.
@Public()
@Controller("config")
export class PublicConfigController {
  constructor(
    private readonly config: ConfigService,
    private readonly flags: FeatureFlagsService,
  ) {}

  @Get()
  async get(): Promise<PublicConfigDto> {
    const raw = await readFile(join(process.cwd(), "package.json"), "utf-8");
    const { version } = JSON.parse(raw) as { version: string };

    return {
      socialEnabled: isSocialEnabled(this.config, this.flags),
      registrationEnabled: isRegistrationEnabled(this.config, this.flags),
      erdEnabled: this.config.get<string>("NODE_ENV") === "development",
      version,
      // Set at build time (see apps/api/Dockerfile) — "unknown" outside a
      // CI-built image (pnpm dev, or any docker compose run against a
      // locally-tagged image rather than one pulled from GHCR).
      gitSha: (process.env.GIT_SHA ?? "unknown").slice(0, 7),
    };
  }
}
